import { Pressable, View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { CollectionRow } from '@/lib/db/queries';

interface ReleaseCardProps {
  item: CollectionRow;
}

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export default function ReleaseCard({ item }: ReleaseCardProps) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2; // 16px padding each side + 16px gap

  return (
    <Pressable
      onPress={() => router.push(`/release/${item.release_id}`)}
      className="bg-[#141414] rounded-xl overflow-hidden mb-4"
      style={{ width: cardWidth }}
    >
      <Image
        source={{ uri: item.cover_url || item.thumb_url }}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        transition={200}
        style={{ width: cardWidth, height: cardWidth }}
      />
      <View className="px-3 py-2">
        <Text
          className="text-white text-sm font-semibold"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.title}
        </Text>
        <Text
          className="text-[#a0a0a0] text-xs mt-0.5"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.artist}
        </Text>
        {item.year > 0 && (
          <Text className="text-[#a0a0a0] text-xs mt-0.5">
            {item.year}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
