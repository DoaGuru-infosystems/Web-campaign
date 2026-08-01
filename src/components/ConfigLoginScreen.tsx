import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { styles } from '../styles/theme';

export interface ConfigLoginScreenProps {
  serverUrl: string;
  setServerUrl: (val: string) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  showConfig: boolean;
  setShowConfig: (val: boolean) => void;
  handleSaveConfig: () => void;
  handleLogin: () => void;
}

export const ConfigLoginScreen: React.FC<ConfigLoginScreenProps> = ({
  serverUrl,
  setServerUrl,
  apiKey,
  setApiKey,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  showConfig,
  setShowConfig,
  handleSaveConfig,
  handleLogin,
}) => {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headerArea}>
          <View style={styles.iconCircle}>
            <SvgIcon type="server" color="#ffffff" size={24} />
          </View>
          <Text style={styles.titleText}>Doctor Camp Admin</Text>
          <Text style={styles.subtitleText}>Client Terminal configuration & Authorization</Text>
        </View>

        {/* Config Settings Toggle Button */}
        <TouchableOpacity style={styles.configToggleBtn} onPress={() => setShowConfig(!showConfig)}>
          <SvgIcon type="settings" color="#4f46e5" size={16} />
          <Text style={styles.configToggleText}>{showConfig ? 'Hide Server Configuration' : 'Configure Server & OCR Key'}</Text>
        </TouchableOpacity>

        {showConfig && (
          <View style={styles.configPanel}>
            <Text style={styles.configTitle}>Network & OCR Settings</Text>
            
            <Text style={styles.inputLabel}>Camp Backend URL</Text>
            <TextInput
              style={styles.textInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.100:5001"
              autoCapitalize="none"
            />
            <Text style={styles.tipText}>
              Tip: Enter your computer's local IP address (e.g. http://192.168.1.X:5001) instead of localhost/127.0.0.1 when running on a physical device.
            </Text>

            <Text style={styles.inputLabel}>OCR.space Cloud API Key</Text>
            <TextInput
              style={styles.textInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="helloworld"
              autoCapitalize="none"
            />
            <Text style={styles.tipText}>
              Use your private OCR.space API key or leave it as "helloworld" for standard rate-limited free test runs.
            </Text>

            <TouchableOpacity style={styles.saveConfigBtn} onPress={handleSaveConfig}>
              <Text style={styles.saveConfigText}>Save Configuration</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Login Fields */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@campaignflow.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Admin Password</Text>
          <TextInput
            style={styles.textInput}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Authorized Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
