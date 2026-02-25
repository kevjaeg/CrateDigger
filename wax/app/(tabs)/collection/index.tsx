import { View, Text } from 'react-native';

export default function CollectionScreen() {
  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-2xl font-bold">Collection</Text>
      <Text className="text-neutral-400 mt-2">Your records will appear here</Text>
    </View>
  );
}
