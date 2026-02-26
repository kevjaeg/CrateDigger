import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center px-5">
        <Text className="text-white text-xl font-bold">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-[#c4882a] text-sm">Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
