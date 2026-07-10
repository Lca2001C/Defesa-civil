import { Box, type SxProps, type Theme } from "@mui/material";
import logoUrl from "../../logo.svg";

interface BrandLogoProps {
  alt?: string;
  size?: number;
  sx?: SxProps<Theme>;
}

export function BrandLogo({ alt = "Defesa Civil MG", size = 34, sx }: BrandLogoProps) {
  const extraSx = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Box
      component="img"
      src={logoUrl}
      alt={alt}
      decoding="async"
      sx={[
        {
          display: "block",
          width: size,
          height: size,
          flexShrink: 0,
          objectFit: "contain",
        },
        ...extraSx,
      ]}
    />
  );
}
