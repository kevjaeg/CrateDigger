import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-2xl font-bold">Profile</Text>
      <Text className="text-neutral-400 mt-2">Stats and settings</Text>
    </View>
  );
}
