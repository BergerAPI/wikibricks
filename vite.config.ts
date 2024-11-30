import type { UserConfig } from 'vite'

export default {
    build: {
        outDir: "./views/vendor",
        rollupOptions: {
            input: {
                "global": "global.css"
            },
            output: {
                format: "es",
                assetFileNames: "[name].css"
            }
        }
    }
} satisfies UserConfig