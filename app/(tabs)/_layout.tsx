import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { colors, radius, shadows, spacing } from '../../src/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIconColor = (focused: boolean) => (focused ? colors.primary : colors.textSecondary);

function NewTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: focused ? colors.primaryPressed : colors.primary,
        borderRadius: radius.full,
        height: 48,
        justifyContent: 'center',
        marginBottom: spacing.sm,
        width: 48,
        ...shadows.md,
      }}
    >
      <Ionicons name="add" size={30} color={colors.surface} />
    </View>
  );
}

function TabIcon({ name, focused }: { name: TabIconName; focused: boolean }) {
  return <Ionicons name={name} size={23} color={tabIconColor(focused)} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 76,
          paddingBottom: spacing.md,
          paddingTop: spacing.sm,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="designs"
        options={{
          title: 'Tasarımlar',
          tabBarIcon: ({ focused }) => <TabIcon name="albums-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="new-design"
        options={{
          title: 'Yeni',
          tabBarIcon: ({ focused }) => <NewTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Müşteriler',
          tabBarIcon: ({ focused }) => <TabIcon name="people-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Diğer',
          tabBarIcon: ({ focused }) => <TabIcon name="menu-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
