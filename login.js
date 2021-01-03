const fs = require('fs').promises;
const puppeteer = require('puppeteer');

(async function main() {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const [page] = await browser.pages();

        await page.setBypassCSP(true);
        try {
            const cookiesString = await fs.readFile('./cookies.json');
            cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
        } catch (error) {
            
        }
        
        page.on('console', msg => console.log(msg.text()));

        await page.goto('https://www.tradingview.com#signin');
        console.log('await start');
        await page.waitFor(120 * 1000);
        console.log('await end');
        cookies = await page.cookies();
        await fs.writeFile('./cookies.json', JSON.stringify(cookies, null, 2));
        console.log('cookie wrote!')
        return 0;
    } catch (err) {
        console.error('err:' + err);
    }
})();