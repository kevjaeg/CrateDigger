import { Stack } from 'expo-router';

export default function CollectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#f5f5f5',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Collection' }} />
    </Stack>
  );
}
