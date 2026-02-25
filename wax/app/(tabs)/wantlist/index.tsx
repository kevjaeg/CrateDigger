import { View, Text } from 'react-native';

export default function WantlistScreen() {
  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-2xl font-bold">Wantlist</Text>
      <Text className="text-neutral-400 mt-2">Records you're looking for</Text>
    </View>
  );
}
