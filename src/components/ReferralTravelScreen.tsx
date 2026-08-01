import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

export interface ReferralTravelScreenProps {
  serverUrl: string;
  token?: string;
  registrationId: string;
  onFinish: () => void;
  isOfflineMode?: boolean;
  updateUnsyncedCounts?: () => void;
}

export const ReferralTravelScreen: React.FC<ReferralTravelScreenProps> = ({
  serverUrl,
  token,
  registrationId,
  onFinish,
  isOfflineMode = false,
  updateUnsyncedCounts,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [referToHospital, setReferToHospital] = useState(false);
  const [travelToHospital, setTravelToHospital] = useState(false);
  const [goingByOwn, setGoingByOwn] = useState(false);

  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        let testObj = null;

        const localTests = await OfflineManager.getOfflineTests();
        const localTest = localTests.find(t => t.registrationId === registrationId);

        if (localTest) {
          testObj = localTest;
        } else if (!isOfflineMode && !registrationId.startsWith('OFFLINE-')) {
          try {
            const res = await API_CALLS.get(`/registrations/${registrationId}/test`, serverUrl, token);
            if (res.test) {
              testObj = res.test;
            }
          } catch (err) {
            console.log('No online referral/travel data:', err);
          }
        }

        if (testObj) {
          setReferToHospital(testObj.refer_to_hospital === 'Yes');
          const travelStr = testObj.travelling_by || '';
          setTravelToHospital(travelStr.includes('Travelling to Hospital'));
          setGoingByOwn(travelStr.includes('Going to hospital by own'));
        }
      } catch (err) {
        console.error('Failed to load existing referral data:', err);
      } finally {
        setFetching(false);
      }
    };
    fetchExistingData();
  }, [registrationId, serverUrl, token, isOfflineMode]);

  const handleSave = async () => {
    setLoading(true);
    
    // Construct travelling_by string
    const travelOptions = [];
    if (travelToHospital) travelOptions.push('Travelling to Hospital');
    if (goingByOwn) travelOptions.push('Going to hospital by own');
    const travellingByStr = travelOptions.length > 0 ? travelOptions.join(', ') : 'None';

    const payload = {
      refer_to_hospital: referToHospital ? 'Yes' : 'No',
      travelling_by: travellingByStr,
    };

    try {
      if (isOfflineMode || registrationId.startsWith('OFFLINE-')) {
        await OfflineManager.queueTest(
          registrationId,
          null,
          null,
          payload.refer_to_hospital,
          payload.travelling_by
        );
        Alert.alert('Details Saved Offline', 'Referral and travel details updated locally on device.');
        if (updateUnsyncedCounts) updateUnsyncedCounts();
      } else {
        await API_CALLS.post(`/registrations/${registrationId}/test`, payload, serverUrl, token);
        Alert.alert('Details Saved', 'Referral and travel details updated successfully.');
      }
      onFinish();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save details.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading referral settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Hospital Referral & Travel Options</Text>
        <Text style={styles.subtitle}>Patient ID: {registrationId}</Text>

        {/* Question 1: Refer to Hospital */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Refer to Hospital?</Text>
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.choiceBtn, referToHospital && styles.choiceBtnActive]}
              onPress={() => setReferToHospital(true)}
            >
              <Text style={[styles.choiceText, referToHospital && styles.choiceTextActive]}>Yes, Refer</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.choiceBtn, !referToHospital && styles.choiceBtnInactiveActive]}
              onPress={() => {
                setReferToHospital(false);
                setTravelToHospital(false);
                setGoingByOwn(false);
              }}
            >
              <Text style={[styles.choiceText, !referToHospital && styles.choiceTextInactiveActiveText]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Question 2: Travel Options */}
        {referToHospital && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Travelling By (Select Mode of Transport)</Text>
            
            <TouchableOpacity 
              style={[styles.checkboxRow, travelToHospital && styles.checkboxRowActive]}
              onPress={() => setTravelToHospital(!travelToHospital)}
            >
              <View style={[styles.checkboxOutline, travelToHospital && styles.checkboxChecked]}>
                {travelToHospital && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Travelling to Hospital (Hospital Vehicle / Bus)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.checkboxRow, goingByOwn && styles.checkboxRowActive]}
              onPress={() => setGoingByOwn(!goingByOwn)}
            >
              <View style={[styles.checkboxOutline, goingByOwn && styles.checkboxChecked]}>
                {goingByOwn && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Going to hospital by own (Private / Self Transport)</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Save Details & Exit</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  choiceBtnActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#e0e7ff',
  },
  choiceBtnInactiveActive: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  choiceTextActive: {
    color: '#4f46e5',
  },
  choiceTextInactiveActiveText: {
    color: '#ef4444',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  checkboxRowActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#f5f3ff',
  },
  checkboxOutline: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
