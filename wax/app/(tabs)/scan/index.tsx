import { View, Text } from 'react-native';

export default function ScanScreen() {
  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-2xl font-bold">Scan</Text>
      <Text className="text-neutral-400 mt-2">Point your camera at a barcode</Text>
    </View>
  );
}
