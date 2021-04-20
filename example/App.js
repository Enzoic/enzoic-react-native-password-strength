import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import ReactNativePasswordStrength from '@enzoic/enzoic-react-native-password-strength';

export default function App() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>React Password Strength Tool</Text>
            <ReactNativePasswordStrength style={{width: "100%", marginBottom: 10}} />

            <Text style={styles.subtitle}>Password Input with Default Value</Text>
            <ReactNativePasswordStrength style={{width: "100%"}} defaultValue={"Password123"}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
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
        marginTop: 30,
        marginBottom: 20
    }
});
