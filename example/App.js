import React from 'react';
import {StyleSheet, Text, View, TextInput, SafeAreaView} from 'react-native';
import {Item, Label, Input, Icon, Content} from 'native-base';
import Enzoic from '@enzoic/enzoic-react-native-password-strength';

export default function App() {
    return (
        <SafeAreaView style={{display: "flex", flex: 1}}>
            <Content contentContainerStyle={styles.container}>
                <Text style={styles.title}>React Password Strength Tool</Text>
                <Enzoic style={{width: "100%", paddingHorizontal: 10, height: 50, borderWidth: 1, borderColor: "#aaa"}}
                        placeholder={"New Password"}
                        inputStyles={{fontSize: 17}}
                        showPasswordIconOverride={<Icon name="eye" style={{color: "blue", fontSize: 24}} />}
                        hidePasswordIconOverride={<Icon name="eye-off" style={{color: "blue", fontSize: 24}} />}
                        tooltipPlacement={"bottom"}
                />

                <Text style={styles.subtitle}>Password Input with Default Value</Text>
                <Enzoic style={{width: "100%", paddingHorizontal: 10, height: 50, borderWidth: 1, borderColor: "#aaa"}}
                        placeholder={"New Password"}
                        defaultValue={"Password123"}
                        inputStyles={{fontSize: 17}}
                />

                <Text style={styles.subtitle}>Example with Native Base Floating Labels</Text>
                <Enzoic style={{width: "100%", marginBottom: 10}}
                        inputComponent={Input}
                        wrapperElement={Item}
                        wrapperElementProps={{floatingLabel: true, underline: true}}
                        insertedElements={<Label key="label">Password</Label>}
                        scoreContainerOffset={-9}
                        language={"es"}
                        showPasswordIconOverride={<Icon name="eye" style={{color: "blue", fontSize: 24}} />}
                        hidePasswordIconOverride={<Icon name="eye-off" style={{color: "blue", fontSize: 24}} />}
                />
            </Content>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 25,
        fontWeight: "bold",
        marginBottom: 30
    },
    subtitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 80,
        marginBottom: 20
    }
});
