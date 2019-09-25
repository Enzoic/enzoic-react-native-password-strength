import React, { Component } from 'react';
import { View, Text, TextInput, ActivityIndicator, Animated, Easing, AppRegistry, Image, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { zxcvbn, isZxcvbnLoaded } from './zxcvbn';
import PropTypes from 'prop-types';
import strings from './strings/enzoic_strings';
import sha1 from './hashes/sha1';
import sha256 from './hashes/sha256';
import md5 from './hashes/md5';
import Tooltip from 'react-native-walkthrough-tooltip';

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
  };

  static defaultProps = {
    changeCallback: null,
    defaultValue: '',
    minLength: 8,
    minScore: 4,
    tooShortWord: 'Too Short',
    userInputs: []
  };

  state = {
    score: 0,
    zxcvbnScore: 0,
    zxcvbnResult: null,
    isValid: false,
    password: '',
    hackedPassword: false,
    breachedPassword: false,
    loading: false,
    modalOpen: false
  };

  constructor(props) {
    super(props);

    this.clear = this.clear.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.checkPasswordWhenReady = this.checkPasswordWhenReady.bind(this);
    this.checkPassword = this.checkPassword.bind(this);
    this.checkPasswordAgainstEnzoic = this.checkPasswordAgainstEnzoic.bind(this);
    this.isTooShort = this.isTooShort.bind(this);

    this.apiURL = 'https://api.enzoic.com';
    this.animatedValue = new Animated.Value(0)
  }

  componentDidMount() {
    const {defaultValue} = this.props;

    if (defaultValue.length > 0) {
      this.setState({password: defaultValue},
        this.handleChange.bind(this, {target: {value: defaultValue}}));
    }
  }

  animate (value) {
    this.animatedValue.setValue(0);
    Animated.timing(
      this.animatedValue,
      {
        toValue: value,
        duration: 300,
        easing: Easing.linear
      }
    ).start()
  }

  clear() {
    const {changeCallback} = this.props;

    this.setState({
      score: 1,
      zxcvbnScore: 1,
      isValid: false,
      password: '',
      loading: false,
    }, () => {
      if (changeCallback !== null) {
        changeCallback(this.state);
      }
    });
  }

  handleChange(password) {
    const {changeCallback, minScore} = this.props;

    this.setState({ password });

    if (password === "") {
      this.setState({
        score: 0,
        zxcvbnScore: 0
      });
      this.animate(0);
      return;
    }

    if (this.isTooShort(password) === false) {
      this.checkPasswordWhenReady(password);
    } else {
      // if password is too, short set a score of 1
      const score = 1;
      this.setState({
        isValid: score >= minScore,
        score,
        zxcvbnScore: 1,
        zxcvbnResult: null,
        loading: false
      }, () => {
        this.animate(score/5);
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
    } else {
      setTimeout(this.checkPasswordWhenReady.bind(this, passwordToCheck), 500);

      this.setState({ loading: true });
    }
  }

  checkPassword(passwordToCheck) {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }

    this.checkTimer = setTimeout(this.checkPasswordAgainstEnzoic.bind(this, passwordToCheck), 500);

    const zxcvbnResult = zxcvbn(passwordToCheck, this.props.userInputs);
    const zxcvbnScore = zxcvbnResult.score + 1;

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
              isValid: this.state.zxcvbnScore >= this.props.minScore
            }, () => {
              this.animate(this.state.score/5);
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
    } else {
      this.setState({loading: false});
    }
  }

  static getMessageFromZXCVBNResult(zxcvbnresult) {
    let message = '';
    let numLines = 0;

    if (zxcvbnresult && zxcvbnresult.feedback) {
      if (zxcvbnresult.feedback.warning) {
        message += zxcvbnresult.feedback.warning+ "\n";
        numLines++;
      }

      if (zxcvbnresult.feedback.suggestions.length > 0) {
        message += strings.suggestion + ":\n";
        numLines++;
        for (let i = 0; i < zxcvbnresult.feedback.suggestions.length; i++) {
          message += zxcvbnresult.feedback.suggestions[i] + "\n";
          numLines++;
        }
      }
    }
    return {message: message, numLines: numLines};
  }

  static getScoreTooltip(score, zxcvbnresult) {
    if (!zxcvbnresult) return null;
    if (score === 0) {
      return <Text style={{color: "black"}}>{strings.breachedPasswordMessage}</Text>;
    }
    else if (score < 4) {
      return <Text style={{color: "black"}}>{Enzoic.getMessageFromZXCVBNResult(zxcvbnresult).message}</Text>;
    }
    return null;
  }

  isTooShort(password) {
    return password.length < this.props.minLength;
  }

  onLayout = event => {
    if (this.state.dimensions) return; // layout was already called
    let { width } = event.nativeEvent.layout;
    this.setState({ width })
  };

  render() {
    const { score, password, loading } = this.state;
    const { scoreWords, style, tooShortWord, minLength, onChangeText } = this.props;

    let backgroundColor;
    if (score < 3) {
      backgroundColor = {backgroundColor: "#FF0000"};
    } else if (score === 3) {
      backgroundColor = {backgroundColor: "#57B8FF"};
    } else {
      backgroundColor = {backgroundColor: "#2FBF71"};
    }

    let padding;
    if (password.length === 0) {
      padding = {padding: 0};
    } else {
      padding = {padding: 4};
    }

    let width = this.animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, this.state.width]
    });

    const scoreTooltip = Enzoic.getScoreTooltip(score, this.state.zxcvbnResult);

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
              onChangeText(text);
            }}
            value={password}
          />
          {(score === 0 && password !== "") ?
            !loading &&
              <Tooltip
                backgroundColor="#000000aa"
                isVisible={this.state.modalOpen === true}
                displayArea={{ x: 0, y: 0, width: Dimensions.get("window").width, height: 100 }}
                content={scoreTooltip}
                placement="top"
                onClose={() => this.setState({ modalOpen: false })}
              >
                <TouchableOpacity 
                  style={Object.assign(
                    {}, 
                    styles.scoreTextContainer, 
                    backgroundColor, 
                    padding, 
                    {top: 0}
                  )} 
                  onPress={() => {
                    if (scoreTooltip) this.setState({ modalOpen: !this.state.modalOpen })
                  }}
                >
                  <Image source={require('./assets/warning.png')} style={{marginRight: 2}} />
                  <Text style={styles.scoreText}>Hacked</Text>
                  <Image source={require('./assets/warning.png')} style={{marginLeft: 2}} />
                </TouchableOpacity>
              </Tooltip>
            :
            !loading &&
              <Tooltip
                backgroundColor="#000000aa"
                animated
                isVisible={this.state.modalOpen === true}
                displayArea={{ x: 0, y: 0, width: Dimensions.get("window").width, height: 100 }}
                content={scoreTooltip}
                placement="top"
                onClose={() => this.setState({ modalOpen: false })}
              >
                <TouchableOpacity 
                  style={Object.assign(
                    {}, 
                    styles.scoreTextContainer, 
                    backgroundColor, 
                    padding, 
                    {top: 0}
                  )} 
                  onPress={() => {
                    if (scoreTooltip) this.setState({ modalOpen: !this.state.modalOpen })
                  }}
                >
                  {password.length > minLength && score !== 4 && score !== 5 && <Image source={require('./assets/info.png')} style={{marginRight: 2}} />}
                  <Text style={styles.scoreText}>{(password.length < minLength && password.length !== 0) ? tooShortWord : password.length ? scoreWords[score] : ""}</Text>
                </TouchableOpacity>
              </Tooltip>
          }
          {loading &&
            <View style={{paddingHorizontal: 15}}>
              <ActivityIndicator size="small" color="#3075b6" />
            </View>
          }
        </View>
        {/* <Animated.View style={Object.assign({}, styles.scoreUnderline, {...width}, backgroundColor)} /> */}
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
    textAlign: "center",
    flex: 1,
    padding: 10,
    backgroundColor: "transparent"
  },
  scoreTextContainer: {
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
  }
};
