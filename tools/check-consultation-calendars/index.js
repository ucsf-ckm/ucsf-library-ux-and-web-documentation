import puppeteer from 'puppeteer';

const options = { }
options.headless = process.env.DEBUG ? false : true;

const linkSelector = '.s-lc-content-mysched a[id]';

const browser = await puppeteer.launch(options);
const page = await browser.newPage();
await page.goto('https://calendars.library.ucsf.edu/');

const links = await page.$$eval(linkSelector, (arr) => arr.map( (el) => el.innerHTML ));
const len = links.length;

let errors = false;

for (let i=0; i<len; i++) {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('iframe')[0].contentWindow.document.body.innerText === ''
    );
  } catch (e) {
    errors = true;
    console.log(`Could not load schedule for ${links[i]}. Skipping.`);
    continue;
  }

  await page.evaluate(`document.querySelectorAll('${linkSelector}')[${i}].click()`);

  const frames = await page.frames();
  // If this fails, then we need to add the error to the array
  try {
    await Promise.race(frames.map((frame) => frame.waitForSelector('#s-lc-appm-dp', { timeout: 3000 })));
  } catch (e) {
    // No appointments available usually means the user's Exchange connector
    // needs to be granted permissions again.
    errors = true;
    console.log(`No appointments available for ${links[i]}`);
  }

  // Close the modal
  await page.evaluate(`Array.from(document.querySelectorAll('a')).filter((el) => el.innerText === 'Close')[${i}].click()`);
}

await page.close();
await browser.close();

if (errors) {
  process.exit(1);
}

console.log(`All ${len} calendars checked have appointments available.`);
