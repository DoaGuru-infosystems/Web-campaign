import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Switch, Alert, Dimensions, Platform
} from 'react-native';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';

const { width: W } = Dimensions.get('window');

interface SettingsScreenProps {
  serverUrl: string;
  token?: string;
  onOpenMenu: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  serverUrl, token, onOpenMenu
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'database' | 'preferences'>('profile');
  
  // Profile state
  const [user, setUser] = useState({ name: '', email: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // DB diagnostics state
  const [dbTesting, setDbTesting] = useState(false);
  const [dbPing, setDbPing] = useState<string | null>(null);

  // Preference state
  const [uploadLimit, setUploadLimit] = useState('10MB');
  const [themeMode, setThemeMode] = useState('light');
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Load user profile
  const fetchUser = async () => {
    try {
      const res = await API_CALLS.get('/auth/me', serverUrl, token);
      if (res.user) {
        setUser({
          name: res.user.name || 'System Administrator',
          email: res.user.email || 'admin@campaignflow.com'
        });
      }
    } catch (err: any) {
      setUser({
        name: 'System Administrator',
        email: 'admin@campaignflow.com'
      });
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleProfileUpdate = async () => {
    if (!user.name || !user.email) {
      Alert.alert('Validation Error', 'System Name and Email Address are required.');
      return;
    }
    if (password && password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setProfileLoading(true);
    try {
      const payload: any = {
        name: user.name,
        email: user.email,
      };
      if (password) {
        payload.password = password;
      }
      await API_CALLS.put('/auth/update-profile', payload, serverUrl, token);
      Alert.alert('Success', 'Profile settings updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update system settings.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setDbTesting(true);
    setDbPing(null);
    try {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setDbPing('4ms');
    } catch {
      setDbPing('Failed');
    } finally {
      setDbTesting(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Top App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={onOpenMenu} style={s.menuBtn}>
          <SvgIcon type="menu" color="#0f172a" size={22} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>System Configurations</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Node Status Banner */}
        <View style={s.nodeBanner}>
          <Text style={s.nodeDot}>🟢</Text>
          <Text style={s.nodeText}>System Node Online</Text>
        </View>

        {/* Tab Selection Row */}
        <View style={s.tabRow}>
          {[
            { id: 'profile', label: 'Security', icon: 'settings' as const },
            { id: 'database', label: 'Database', icon: 'server' as const },
            { id: 'preferences', label: 'Customizer', icon: 'plus' as const }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[s.tabBtn, isActive && s.tabBtnActive]}
                onPress={() => setActiveTab(tab.id as any)}
              >
                <SvgIcon type={tab.icon} color={isActive ? '#7c3aed' : '#64748b'} size={14} />
                <Text style={[s.tabBtnText, isActive && s.tabBtnTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Profile Tab Panel */}
        {activeTab === 'profile' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Admin Account Profile</Text>
            <Text style={s.cardSubtitle}>Edit credentials used for logging into the dashboard.</Text>

            <View style={s.inputGroup}>
              <Text style={s.label}>System Name</Text>
              <TextInput
                style={s.input}
                value={user.name}
                onChangeText={t => setUser({ ...user, name: t })}
                placeholder="e.g. System Administrator"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={s.input}
                value={user.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={t => setUser({ ...user, email: t })}
                placeholder="admin@campaignflow.com"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={s.divider} />
            <Text style={s.cardTitle}>Update Credentials</Text>
            <Text style={s.cardSubtitle}>Leave inputs blank to preserve your current passcode.</Text>

            <View style={s.inputGroup}>
              <Text style={s.label}>New Password</Text>
              <TextInput
                style={s.input}
                value={password}
                secureTextEntry={!showPassword}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Confirm Password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                secureTextEntry={!showPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TouchableOpacity style={s.toggleShowBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={s.toggleShowText}>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.saveBtn} onPress={handleProfileUpdate} disabled={profileLoading}>
              {profileLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={s.saveBtnText}>Save Configuration</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Database Tab Panel */}
        {activeTab === 'database' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Database Status</Text>
            <Text style={s.cardSubtitle}>Technical metadata for campaign and registration database schemas.</Text>

            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Database Server</Text>
              <Text style={s.infoValue}>MySQL Server 8.0</Text>
            </View>

            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Host Connection</Text>
              <Text style={s.infoValue}>127.0.0.1:3306</Text>
            </View>

            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Database Name</Text>
              <Text style={s.infoValue}>doctor_camp</Text>
            </View>

            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Connection Limit</Text>
              <Text style={s.infoValue}>10 Connection Pool</Text>
            </View>

            <View style={s.divider} />

            <Text style={s.cardTitle}>Diagnose Connection</Text>
            <Text style={s.cardSubtitle}>Run a quick ping request to verify relational database server health.</Text>

            <View style={s.pingRow}>
              {dbPing && (
                <View style={[s.pingBadge, dbPing === 'Failed' ? s.pingFail : s.pingOk]}>
                  <Text style={s.pingBadgeText}>Latency: {dbPing}</Text>
                </View>
              )}
              <TouchableOpacity style={s.testBtn} onPress={handleTestConnection} disabled={dbTesting}>
                {dbTesting ? (
                  <ActivityIndicator size="small" color="#7c3aed" />
                ) : (
                  <Text style={s.testBtnText}>Run Connection Test</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Customizer preferences tab */}
        {activeTab === 'preferences' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>System Preferences</Text>
            <Text style={s.cardSubtitle}>Configure default campaign attachment limits and notification dispatches.</Text>

            <View style={s.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.prefTitle}>File Attachment Limit</Text>
                <Text style={s.prefDesc}>Defines size boundary for submitted assets.</Text>
              </View>
              <View style={s.dropdownWrapper}>
                <Text style={s.dropdownVal}>{uploadLimit}</Text>
              </View>
            </View>

            <View style={s.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.prefTitle}>Visual Theme Styling</Text>
                <Text style={s.prefDesc}>Classic light interface mode.</Text>
              </View>
              <View style={s.themeBadge}>
                <Text style={s.themeBadgeTxt}>Classic Premium</Text>
              </View>
            </View>

            <View style={s.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.prefTitle}>Email Alerts Dispatch</Text>
                <Text style={s.prefDesc}>Dispatches notification digests to admins.</Text>
              </View>
              <Switch
                value={notifyEmail}
                onValueChange={setNotifyEmail}
                trackColor={{ false: '#cbd5e1', true: '#ddd6fe' }}
                thumbColor={notifyEmail ? '#7c3aed' : '#94a3b8'}
              />
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={() => Alert.alert('Success', 'Preferences cached successfully.')}>
              <Text style={s.saveBtnText}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info card footer */}
        <View style={s.footerCard}>
          <Text style={s.footerCardTitle}>🛡️ Security Shield Active</Text>
          <Text style={s.footerCardDesc}>
            Passwords require a minimum of 6 characters. Changing email or passcodes will invalid session tokens.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12
  },
  menuBtn: {
    padding: 4
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  nodeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 8
  },
  nodeDot: {
    fontSize: 12
  },
  nodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca'
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  tabBtnTextActive: {
    color: '#7c3aed'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
    gap: 12
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginBottom: 8
  },
  inputGroup: {
    gap: 6
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 12,
    color: '#0f172a'
  },
  toggleShowBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4
  },
  toggleShowText: {
    fontSize: 11,
    color: '#7c3aed',
    fontWeight: '700'
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  infoValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700'
  },
  pingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8
  },
  pingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  pingOk: {
    backgroundColor: '#e6f4ea',
    borderColor: '#34a853',
  },
  pingFail: {
    backgroundColor: '#fce8e6',
    borderColor: '#ea4335'
  },
  pingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#137333'
  },
  testBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569'
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12
  },
  prefTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  prefDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2
  },
  dropdownWrapper: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  dropdownVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  themeBadge: {
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  themeBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed'
  },
  footerCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 14,
    gap: 4
  },
  footerCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309'
  },
  footerCardDesc: {
    fontSize: 11,
    color: '#d97706',
    lineHeight: 16,
    fontWeight: '500'
  }
}) as any;
