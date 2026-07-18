import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '../../../theme';

type FavoriteButtonProps = {
  isFavorite: boolean;
  label: string;
  onPress: () => void;
};

export function FavoriteButton({ isFavorite, label, onPress }: FavoriteButtonProps) {
  return (
    <Pressable
      accessibilityLabel={isFavorite ? `${label} favoriden çıkar` : `${label} favoriye ekle`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={22}
        color={isFavorite ? colors.error : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
