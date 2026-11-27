import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F4F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEDEA',
  border: '#E2E2DE',
  text: '#141414',
  textMuted: '#62625E',
  header: '#111111',
  headerText: '#FFFFFF',
  accent: '#FFD400',
  accentText: '#111111',
  sale: '#D7261E',
  good: '#167A3E',
  goodBg: '#E3F4EA',
  warn: '#9A5B00',
  warnBg: '#FFF1D6',
  neutralBg: '#EDEDEA',
  link: '#111111',
};

const dark: typeof light = {
  bg: '#0B0B0B',
  surface: '#171717',
  surfaceAlt: '#222222',
  border: '#2C2C2C',
  text: '#F2F2F0',
  textMuted: '#A3A39E',
  header: '#000000',
  headerText: '#FFFFFF',
  accent: '#FFD400',
  accentText: '#111111',
  sale: '#FF5A52',
  good: '#4CC97A',
  goodBg: '#12301E',
  warn: '#F2B14C',
  warnBg: '#33260F',
  neutralBg: '#222222',
  link: '#FFD400',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };
export const space = (n: number) => n * 4;
