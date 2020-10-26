const puppeteer = require('puppeteer');
const fs = require('fs').promises;

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], defaultViewport: false});
  const page = await browser.newPage();
  await page.setBypassCSP(true);
  const cookiesString = await fs.readFile('./cookies.json');
  const cookies = JSON.parse(cookiesString);
  await page.setCookie(...cookies);
  await page.goto('https://www.tradingview.com/chart/siPoFOHy/');
  await page.waitForSelector('.sourcesWrapper-2JcXD9TK .valueValue-3kA0oJs5');
  await page.screenshot({path: 'buddy-screenshot.png'});

  await browser.close();
})();