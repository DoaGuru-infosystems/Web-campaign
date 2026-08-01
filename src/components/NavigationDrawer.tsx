import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
import { SvgIcon } from './SvgIcon';

const { width: screenWidth } = Dimensions.get('window');
const DRAWER_WIDTH = screenWidth * 0.78;

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  user: any;
  handleLogout: () => void;
  isOfflineMode?: boolean;
  unsyncedCount?: number;
  onSync?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentScreen,
  onNavigate,
  user,
  handleLogout,
  isOfflineMode = false,
  unsyncedCount = 0,
  onSync,
}) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: 'server' },
    { id: 'CAMPAIGNS', label: 'View Campaigns', icon: 'megaphone' },
    { id: 'REGISTERED_PATIENTS', label: 'Registered Patients', icon: 'users' },
    ...(user?.role === 'Admin' ? [
      { id: 'CREATE_CAMPAIGN', label: 'Create Campaign', icon: 'plus' },
      { id: 'TEST_TEMPLATES', label: 'Test Templates', icon: 'clipboard' },
      { id: 'ALL_ENTRIES', label: 'All Entries', icon: 'users' },
      { id: 'REPORTS', label: 'Reports', icon: 'activity' },
      { id: 'SETTINGS', label: 'Settings', icon: 'settings' },
    ] : []),
  ];

  const handlePressItem = (screenId: string) => {
    onNavigate(screenId);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Close Handler */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Drawer Menu Body */}
        <View style={styles.drawerContainer}>
          <SafeAreaView style={styles.safeContainer}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.logoBlock}>
                <View style={styles.logoBadge}>
                  <SvgIcon type="sparkles" color="#ffffff" size={16} />
                </View>
                <Text style={styles.logoText}>CampaignFlow</Text>
              </View>
              <Text style={styles.logoSubtext}>{user?.role === 'Admin' ? 'MOBILE ADMIN CONSOLE' : 'MOBILE EMPLOYEE CONSOLE'}</Text>
            </View>

            {/* Navigation links list */}
            <View style={styles.menuList}>
              {menuItems.map((item) => {
                const isActive = currentScreen === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handlePressItem(item.id)}
                  >
                    <SvgIcon 
                      type={item.icon} 
                      color={isActive ? '#4f46e5' : '#64748b'} 
                      size={18} 
                    />
                    <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Profile Details */}
            <View style={styles.drawerFooter}>
              <View style={styles.profileRow}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.avatarLetter}>
                    {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
                  </Text>
                </View>
                <View style={styles.profileDetails}>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user?.email || 'admin@campaignflow.com'}
                  </Text>
                  <Text style={styles.profileRole}>{user?.role || 'Administrator'}</Text>
                </View>
              </View>

              {/* Sync section in drawer footer */}
              {unsyncedCount > 0 && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', gap: 6, marginVertical: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>Unsynced Records</Text>
                    <View style={{ backgroundColor: '#16a34a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }}>{unsyncedCount}</Text>
                    </View>
                  </View>
                  {!isOfflineMode ? (
                    <TouchableOpacity 
                      style={{ backgroundColor: '#16a34a', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }} 
                      onPress={() => {
                        if (onSync) onSync();
                      }}
                    >
                      <SvgIcon type="sparkles" color="#ffffff" size={12} />
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Sync Now</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 9, color: '#15803d', fontStyle: 'italic', textAlign: 'center' }}>Connect to internet to sync.</Text>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <SvgIcon type="logout" color="#ef4444" size={16} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  safeContainer: {
    flex: 1,
  },
  drawerHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginTop: 4,
  },
  menuList: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#e0e7ff',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  menuItemTextActive: {
    color: '#4f46e5',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4f46e5',
  },
  profileDetails: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  profileRole: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
