import React, {Component} from 'react';
import {
    View,
    Text,
    TextInput,
    Animated,
    Easing,
    AppRegistry,
    Image,
    TouchableOpacity,
    Keyboard,
} from 'react-native';
import {zxcvbn, isZxcvbnLoaded} from './zxcvbn';
import PropTypes from 'prop-types';
import strings from './strings/enzoic_strings';
import sha1 from './hashes/sha1';
import sha256 from './hashes/sha256';
import md5 from './hashes/md5';
import Tooltip from 'react-native-walkthrough-tooltip';
import WarningImage from './assets/warning.png';
import InfoImage from './assets/info.png';

export default class Enzoic extends Component {
    static propTypes = {
        changeCallback: PropTypes.func,
        defaultValue: PropTypes.string,
        minLength: PropTypes.number,
        minScore: PropTypes.number,
        scoreWords: PropTypes.array,
        style: PropTypes.object,
        tooShortWord: PropTypes.string,
        userInputs: PropTypes.array,
        language: PropTypes.string,
    };

    static defaultProps = {
        changeCallback: null,
        defaultValue: '',
        minLength: 8,
        minScore: 4,
        userInputs: [],
        language: "en"
    };

    state = {
        score: 1,
        zxcvbnScore: 0,
        zxcvbnResult: null,
        isValid: false,
        password: '',
        breachedPassword: false,
        loading: false,
        modalOpen: false,
        strengthBarWidth: new Animated.Value(0),
        loaderScale: new Animated.Value(0),
        loaderOpacity: new Animated.Value(1)
    };

    constructor(props) {
        super(props);

        this.clear = this.clear.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.checkPasswordWhenReady = this.checkPasswordWhenReady.bind(this);
        this.checkPassword = this.checkPassword.bind(this);
        this.checkPasswordAgainstEnzoic = this.checkPasswordAgainstEnzoic.bind(this);
        this.isTooShort = this.isTooShort.bind(this);
        this.getStrings = this.getStrings.bind(this);
        this.getTooShortWord = this.getTooShortWord.bind(this);
        this.getScoreWord = this.getScoreWord.bind(this);
        this.getMessageFromZXCVBNResult = this.getMessageFromZXCVBNResult.bind(this);
        this.getScoreTooltip = this.getScoreTooltip.bind(this);

        this.apiURL = 'https://api.enzoic.com';
    }

    componentDidMount() {
        const {defaultValue} = this.props;

        if (defaultValue.length > 0) {
            this.setState({password: defaultValue},
                this.handleChange.bind(this, defaultValue));
        }
    }

    animate(value) {
        Animated.timing(
            this.state.strengthBarWidth,
            {
                toValue: value * this.state.width,
                duration: 300,
                easing: Easing.linear,
                useNativeDriver: false
            }
        ).start()
    }

    clear() {
        const {changeCallback} = this.props;

        this.setState({
            score: 1,
            breachedPassword: false,
            zxcvbnScore: 1,
            isValid: false,
            password: '',
            loading: false,
        }, () => {
            if (changeCallback !== null) {
                changeCallback(this.state);
            }

            this.animate(0);
        });
    }

    handleChange(password) {
        const {changeCallback, minScore} = this.props;

        this.setState({password});

        if (password === "") {
            this.setState({
                score: 0,
                breachedPassword: false,
                zxcvbnScore: 0
            });
            this.animate(0);
            return;
        }

        if (this.isTooShort(password) === false) {
            this.checkPasswordWhenReady(password);
        }
        else {
            // if password is too short set a score of 1
            const score = 1;

            this.setState({
                isValid: score >= minScore,
                score,
                breachedPassword: false,
                zxcvbnScore: 1,
                zxcvbnResult: null,
                loading: false
            }, () => {
                this.animate(score / 5);
                if (changeCallback !== null) {
                    changeCallback(this.state, null);
                }
            });
        }
    }

    checkPasswordWhenReady(passwordToCheck) {
        // wait for zxcvbn to be loaded
        if (isZxcvbnLoaded() === true) {
            this.checkPassword(passwordToCheck);
        }
        else {
            setTimeout(this.checkPasswordWhenReady.bind(this, passwordToCheck), 500);

            this.startLoaderAnimation();
            this.setState({loading: true});
        }
    }

    checkPassword(passwordToCheck) {
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
        }
        this.checkTimer = setTimeout(this.checkPasswordAgainstEnzoic.bind(this, passwordToCheck), 500);

        const zxcvbnResult = zxcvbn(passwordToCheck, this.props.userInputs, this.props.language);
        let zxcvbnScore = zxcvbnResult.score + 1;

        // add on - check for all numbers
        if (zxcvbnScore > 1 && /^[0-9]+$/.test(passwordToCheck)) {
            zxcvbnScore = 1;
            zxcvbnResult.feedback.warning = this.getStrings().suggestions.allNumbers;
            zxcvbnResult.feedback.suggestions = [];
        }

        this.startLoaderAnimation();

        // store zxcvbn results and set state to loading while Enzoic check is processing
        this.setState({
            isValid: this.state.score >= this.props.minScore,
            score: this.state.score,
            zxcvbnScore,
            zxcvbnResult,
            loading: true
        });
    }

    checkPasswordAgainstEnzoic(passwordToCheck) {
        // if we already had an outstanding request in progress, cancel
        if (this.ppCurrentRequest) {
            this.ppCurrentRequest.abort();
            this.ppCurrentRequest = undefined;
        }

        if (passwordToCheck) {
            const sha2hash = sha256.hash(passwordToCheck);
            const sha1hash = sha1.hash(passwordToCheck);
            const md5hash = md5(passwordToCheck);
            const sha2partial = sha2hash.substr(0, 10);
            const sha1partial = sha1hash.substr(0, 10);
            const md5partial = md5hash.substr(0, 10);

            this.ppCurrentRequest = new XMLHttpRequest();

            this.ppCurrentRequest.onreadystatechange = () => {
                if (this.ppCurrentRequest && this.ppCurrentRequest.readyState === 4) {
                    let found = false;

                    if (this.ppCurrentRequest.status === 200) {
                        try {
                            // loop through and see if we have a match
                            const result = JSON.parse(this.ppCurrentRequest.response);
                            if (result.candidates) {
                                for (let i = 0; i < result.candidates.length; i++) {
                                    if (result.candidates[i].md5 === md5hash ||
                                        result.candidates[i].sha1 === sha1hash ||
                                        result.candidates[i].sha256 === sha2hash) {
                                        this.setState({
                                            score: 0,
                                            breachedPassword: result.candidates[i].revealedInExposure === true,
                                            isValid: false,
                                            loading: false
                                        }, () => {
                                            this.animate(0.2);
                                            if (this.props.changeCallback !== null) {
                                                this.props.changeCallback(this.state, this.state.zxcvbnResult);
                                            }
                                        });
                                        found = true;
                                        break;
                                    }
                                }
                            }
                        }
                        catch (err) {
                            console.error('Unexpected response from PP API: ' + err);
                        }
                    }

                    if (found === false) {
                        this.setState({
                            loading: false,
                            score: this.state.zxcvbnScore,
                            breachedPassword: false,
                            isValid: this.state.zxcvbnScore >= this.props.minScore
                        }, () => {
                            this.animate(this.state.score / 5);
                            if (this.props.changeCallback !== null) {
                                this.props.changeCallback(this.state, this.state.zxcvbnResult);
                            }
                        });
                    }
                    this.ppCurrentRequest = undefined;
                }
            };

            this.ppCurrentRequest.open('GET',
                `${this.apiURL}/passwords?partial_sha2=${sha2partial}&partial_sha1=${sha1partial}&partial_md5=${md5partial}`,
                true);
            this.ppCurrentRequest.setRequestHeader('Origin', AppRegistry.getAppKeys()[0]);
            this.ppCurrentRequest.timeout = 1500;
            this.ppCurrentRequest.send();
        }
        else {
            this.setState({loading: false});
        }
    }

    getMessageFromZXCVBNResult(zxcvbnresult) {
        let message = [];
        let numLines = 0;

        if (zxcvbnresult && zxcvbnresult.feedback) {
            let scoreWord = this.getStrings().strengthRatings[this.state.score];
            if (this.props.scoreWords && this.props.scoreWords.length === 6) {
                scoreWord = this.props.scoreWords[this.state.score];
            }

            message.push(<Text key={numLines++} style={styles.tooltipTitle}>
                {this.getStrings().passwordStrength + ": " + scoreWord + "\n"}
            </Text>);

            if (zxcvbnresult.feedback.warning) {
                message.push(<Text key={numLines} style={styles.tooltipBody}>
                    {zxcvbnresult.feedback.warning + "\n"}
                </Text>);
                numLines++;
            }

            if (zxcvbnresult.feedback.suggestions.length > 0) {
                message.push(<Text key={numLines} style={styles.tooltipSubtitle}>
                    {this.getStrings().suggestion + ":\n"}
                </Text>);
                numLines++;

                for (let i = 0; i < zxcvbnresult.feedback.suggestions.length; i++) {
                    message.push(<Text key={numLines} style={styles.tooltipBody}>
                        {"\u2022 " + zxcvbnresult.feedback.suggestions[i] + "\n"}
                    </Text>);
                    numLines++;
                }
            }
        }
        return {message: message, numLines: numLines};
    }

    getScoreTooltip(score, zxcvbnresult) {
        if (!zxcvbnresult) return null;

        if (score === 0) {
            if (this.state.breachedPassword === true) {
                return [
                    <Text key="1" style={styles.tooltipTitle}>{this.getStrings().hackedPasswordTitle + "\n"}</Text>,
                    <Text key="2" style={styles.tooltipBody}>{this.getStrings().breachedPasswordMessage}</Text>
                ];
            }
            else {
                return [
                    <Text key="1" style={styles.tooltipTitle}>{this.getStrings().hackedPasswordTitle + "\n"}</Text>,
                    <Text key="2" style={styles.tooltipBody}>{this.getStrings().hackedPasswordMessage}</Text>
                ];
            }
        }
        else if (score < 4) {
            return this.getMessageFromZXCVBNResult(zxcvbnresult).message;
        }

        return null;
    }

    isTooShort(password) {
        return password.length < this.props.minLength;
    }

    onLayout = event => {
        if (this.state.width) return; // layout was already called
        let {width} = event.nativeEvent.layout;
        this.setState({width})
    };

    getStrings() {
        return strings[this.props.language] || strings['en'];
    }

    getScoreWord(score) {
        let scoreWord = this.getStrings().strengthRatings[score];
        if (this.props.scoreWords && this.props.scoreWords.length === 6) {
            scoreWord = this.props.scoreWords[score]
        }

        switch (score) {
            case 0:
                return [
                    <Image source={{uri: WarningImage}} style={[styles.warningIcon, {marginRight: 2}]}/>,
                    <Text style={styles.scoreText}>{scoreWord}</Text>,
                    <Image source={{uri: WarningImage}} style={[styles.warningIcon, {marginLeft: 4}]}/>
                ];
            case 1:
            case 2:
            case 3:
                return [
                    <Image source={{uri: InfoImage}} style={[styles.infoIcon, {marginRight: 2}]}/>,
                    <Text style={styles.scoreText}>{scoreWord}</Text>
                ];
            default:
                return <Text style={styles.scoreText}>{scoreWord}</Text>
        }
    }

    getTooShortWord() {
        return <Text style={styles.scoreText}>
            {this.props.tooShortWord || this.getStrings().tooShort}
        </Text>;
    }

    getBackgroundColor(password, loading, score, forContainer) {
        // don't show container if no password entered or we're loading
        if ((!forContainer && loading) || !password || password.length === 0) return "#00000000";

        if (score < 3) {
            return "#FF0000";
        }
        else if (score === 3) {
            return "#57B8FF";
        }
        else {
            return "#2FBF71";
        }
    }

    startLoaderAnimation() {
        Animated.loop(
            Animated.parallel([
                Animated.timing(this.state.loaderScale, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: false
                }),
                Animated.timing(this.state.loaderOpacity, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false
                })
            ])
        ).start();
    }

    render() {
        const {score, password, loading} = this.state;
        const {style, onChangeText} = this.props;

        const containerBackgroundColor = this.getBackgroundColor(password, loading, score, false);
        const barBackgroundColor = this.getBackgroundColor(password, loading, score, true);

        const strengthDesc = loading || !password || password.length === 0
            ? <></>
            : this.isTooShort(password)
                ? this.getTooShortWord()
                : this.getScoreWord(score);

        const scoreTooltip = this.getScoreTooltip(score, this.state.zxcvbnResult);
        if (this.state.modalOpen === true) Keyboard.dismiss();

        return (
            <View style={style} onLayout={this.onLayout}>
                <View style={styles.main}>
                    <TextInput
                        underlineColorAndroid="transparent"
                        placeholder="New Password"
                        placeholderTextColor="#b0b0b0"
                        style={styles.input}
                        type="password"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(text) => {
                            this.handleChange(text);
                            if (onChangeText) onChangeText(text);
                        }}
                        value={password}
                    />
                    <Tooltip
                        backgroundColor="#000000aa"
                        isVisible={this.state.modalOpen === true}
                        content={scoreTooltip}
                        placement="top"
                        onClose={() => this.setState({modalOpen: false})}
                    >
                        <TouchableOpacity
                            style={[styles.scoreTextContainer, {backgroundColor: containerBackgroundColor}]}
                            onPress={() => {
                                if (scoreTooltip) this.setState({modalOpen: !this.state.modalOpen})
                            }}
                        >
                            <Animated.View style={[
                                styles.loaderIcon, {
                                    display: loading === true ? "flex" : "none",
                                    opacity: this.state.loaderOpacity,
                                    transform: [
                                        {scale: this.state.loaderScale}
                                    ]
                                }
                            ]}/>
                            {strengthDesc}
                        </TouchableOpacity>
                    </Tooltip>
                </View>
                <Animated.View style={[styles.scoreUnderline,
                    {width: this.state.strengthBarWidth, backgroundColor: barBackgroundColor}]}/>
            </View>
        )
    }
}

const styles = {
    main: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#D9D5DC",
        paddingHorizontal: 10,
        height: 50
    },
    input: {
        fontSize: 17,
        textAlign: "left",
        flex: 1,
        padding: 10,
        backgroundColor: "transparent"
    },
    scoreTextContainer: {
        padding: 4,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 10,
    },
    scoreText: {
        fontSize: 12,
        color: "white",
        right: 0,
        textAlign: "center",
        backgroundColor: "transparent"
    },
    scoreUnderline: {
        position: "absolute",
        bottom: -2,
        height: 4,
    },
    warningIcon: {
        position: "relative",
        top: -1,
        width: 14,
        height: 14
    },
    infoIcon: {
        width: 15,
        height: 15
    },
    loaderIcon: {
        position: "absolute",
        right: 10,
        backgroundColor: "#333",
        width: 40,
        height: 40,
        borderRadius: 40
    },
    tooltipTitle: {
        color: "black",
        fontSize: 18,
        fontWeight: "bold"
    },
    tooltipBody: {
        color: "black"
    },
    tooltipSubtitle: {
        color: "black",
        fontWeight: "bold"
    }
};
