/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: ['class', '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                background: "#09090b", // Very dark, almost black
                foreground: "#ffffff",

                card: "#18181b", // Zinc 900ish - Matte dark
                "card-foreground": "#ffffff",

                primary: "#8b5cf6", // Violet 500
                "primary-foreground": "#ffffff",

                secondary: "#27272a", // Zinc 800
                "secondary-foreground": "#a1a1aa", // Zinc 400

                muted: "#27272a",
                "muted-foreground": "#71717a",

                border: "#27272a",
                input: "#27272a",

                // Status colors matching screenshot
                success: "#10b981", // Green
                warning: "#f59e0b", // Amber/Yellow
                danger: "#ef4444", // Red
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Screenshot looks like Inter
            },
            borderRadius: {
                'xl': '12px',
                '2xl': '16px',
            }
        },
    },
    plugins: [],
}
