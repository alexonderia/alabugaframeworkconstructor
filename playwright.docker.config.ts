import {defineConfig,devices} from '@playwright/test';

// Exercise the already running Docker release through its public UI.
export default defineConfig({
 testDir:'./tests',testMatch:['ui-acceptance.spec.ts','framework-components.spec.ts','editor-layout.spec.ts','editor-followup.spec.ts','editor-dialogs.spec.ts'],outputDir:'artifacts/docker-ui-tests',
 workers:2,timeout:30000,
 use:{baseURL:process.env.AF_ACCEPTANCE_URL||'http://127.0.0.1:4176',viewport:{width:1440,height:1000},reducedMotion:'reduce',trace:'retain-on-failure'},
 projects:[
  {name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.AF_BROWSER_CHANNEL as 'chrome'|undefined}},
  {name:'firefox',use:{...devices['Desktop Firefox'],launchOptions:{executablePath:process.env.AF_FIREFOX_EXECUTABLE,firefoxUserPrefs:{'network.proxy.type':0}}}},
  {name:'webkit',use:{...devices['Desktop Safari'],launchOptions:{executablePath:process.env.AF_WEBKIT_EXECUTABLE}}}
 ]
});
