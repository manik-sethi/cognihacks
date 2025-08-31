// tailwind.config.js
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          glow: "hsl(var(--accent-glow))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        glass: "hsl(var(--glass))",
        neural: {
          low: "hsl(var(--neural-low))",
          medium: "hsl(var(--neural-medium))",
          high: "hsl(var(--neural-high))",
          critical: "hsl(var(--neural-critical))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "neural-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%":     { opacity: "1", transform: "scale(1.05)" },
        },
        "brain-wave": {
          "0%": { transform: "translateY(0px)" },
          "25%": { transform: "translateY(-2px)" },
          "50%": { transform: "translateY(0px)" },
          "75%": { transform: "translateY(2px)" },
          "100%": { transform: "translateY(0px)" },
        },
        "data-flow": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "neural-pulse": "neural-pulse 2s ease-in-out infinite",
        "brain-wave": "brain-wave 3s ease-in-out infinite",
        "data-flow": "data-flow 2s linear infinite",
      },

      /* Optional: small prose tweaks (dark-friendly) */
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: "none",
            h1: { color: theme("colors.foreground"), fontWeight: "700" },
            h2: { color: theme("colors.foreground"), fontWeight: "700" },
            h3: { color: theme("colors.foreground"), fontWeight: "600" },
            code: { color: theme("colors.accent.foreground") },
          },
        },
        invert: {
          css: {
            "--tw-prose-body": theme("colors.zinc.200"),
            "--tw-prose-headings": theme("colors.zinc.100"),
            "--tw-prose-links": theme("colors.primary.DEFAULT"),
            "--tw-prose-bold": theme("colors.zinc.100"),
            "--tw-prose-counters": theme("colors.zinc.400"),
            "--tw-prose-bullets": theme("colors.zinc.600"),
          },
        },
      }),
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"), // ← adds `prose` classes for Markdown/CMS content
  ],
} satisfies Config;
