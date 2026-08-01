import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SvgIcon } from './SvgIcon';
import { styles } from '../styles/theme';

export interface SuccessReceiptScreenProps {
  selectedCampaign: any;
  submitReceipt: any;
  setSubmitReceipt: (val: any) => void;
  setCurrentScreen: (val: any) => void;
  onOpenTestForm: (registrationId: string) => void;
}

export const SuccessReceiptScreen: React.FC<SuccessReceiptScreenProps> = ({
  selectedCampaign,
  submitReceipt,
  setSubmitReceipt,
  setCurrentScreen,
  onOpenTestForm,
}) => {
  if (!submitReceipt) return null;

  return (
    <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContainer}>
      <View style={styles.successCard}>
        <View style={styles.successIconCircle}>
          <SvgIcon type="check" color="#ffffff" size={32} />
        </View>

        <Text style={styles.successTitle}>Registration Complete!</Text>
        <Text style={styles.successMessage}>{submitReceipt.thankYouMessage}</Text>

        <View style={styles.receiptDetails}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>CAMPAIGN TITLE</Text>
            <Text style={styles.receiptValue}>{selectedCampaign?.title}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>REGISTRATION ID</Text>
            <Text style={styles.receiptIdValue}>{submitReceipt.registrationId}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>SUBMISSION TIME</Text>
            <Text style={styles.receiptValue}>{new Date().toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.successTip}>
          The registration ticket details are uploaded. Please copy the registration ID.
        </Text>

        <View style={styles.successActionRow}>
          <TouchableOpacity 
            style={styles.copyIdBtn} 
            onPress={async () => {
              await Clipboard.setStringAsync(submitReceipt.registrationId);
              Alert.alert('Copied', 'Registration ID copied to clipboard.');
            }}
          >
            <Text style={styles.copyIdText}>Copy Registration ID</Text>
          </TouchableOpacity>

          {selectedCampaign?.test_template_id ? (
            <TouchableOpacity 
              style={[styles.successBackBtn, { backgroundColor: '#0a4a9f', marginVertical: 6, width: '100%', alignItems: 'center' }]} 
              onPress={() => {
                const regId = submitReceipt.registrationId;
                setSubmitReceipt(null);
                onOpenTestForm(regId);
              }}
            >
              <Text style={[styles.successBackText, { color: '#ffffff' }]}>🧪 Run Diagnostic Test</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity 
            style={[styles.successBackBtn, { backgroundColor: '#10b981', marginVertical: 6, width: '100%', alignItems: 'center' }]} 
            onPress={() => {
              setSubmitReceipt(null);
              setCurrentScreen('FORM');
            }}
          >
            <Text style={[styles.successBackText, { color: '#ffffff' }]}>👤 Register New Patient</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.successBackBtn, { backgroundColor: '#f1f5f9', marginTop: 12, width: '100%', alignItems: 'center' }]} 
            onPress={() => {
              setSubmitReceipt(null);
              setCurrentScreen('CAMPAIGNS');
            }}
          >
            <Text style={[styles.successBackText, { color: '#475569' }]}>Back to Campaigns</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
