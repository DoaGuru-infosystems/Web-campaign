import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        {/* @ts-expect-error unstable-native-tabs Trigger typings */}
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        {/* @ts-expect-error unstable-native-tabs Trigger typings */}
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="explore">
        {/* @ts-expect-error unstable-native-tabs Trigger typings */}
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        {/* @ts-expect-error unstable-native-tabs Trigger typings */}
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
