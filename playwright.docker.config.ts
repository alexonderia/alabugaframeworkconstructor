import {defineConfig,devices} from '@playwright/test';

// Exercise the already running Docker release through its public UI.
export default defineConfig({
 testDir:'./tests',testMatch:['ui-acceptance.spec.ts','framework-components.spec.ts','editor-layout.spec.ts','editor-followup.spec.ts','editor-dialogs.spec.ts','library-dialogs.spec.ts','project-dialogs.spec.ts','editor-recovery-dialogs.spec.ts','editor-responsive.spec.ts','project-transition.spec.ts','block-actions.spec.ts','settings-spacing.spec.ts','surface-polish.spec.ts','controls-layout.spec.ts','demo-diagnostics.spec.ts'],outputDir:'artifacts/release/docker-tests',
 workers:2,timeout:30000,
 use:{baseURL:process.env.AF_ACCEPTANCE_URL||'http://127.0.0.1:4176',viewport:{width:1440,height:1000},reducedMotion:'reduce',trace:'retain-on-failure'},
 projects:[
  {name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.AF_BROWSER_CHANNEL as 'chrome'|undefined}},
  {name:'firefox',use:{...devices['Desktop Firefox'],launchOptions:{executablePath:process.env.AF_FIREFOX_EXECUTABLE,firefoxUserPrefs:{'network.proxy.type':0}}}},
  {name:'webkit',use:{...devices['Desktop Safari'],launchOptions:{executablePath:process.env.AF_WEBKIT_EXECUTABLE}}}
 ]
});
