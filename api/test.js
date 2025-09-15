import puppeteer from "puppeteer-core";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const upstreamUrl = "http://playground-api.browser.ihuaj.com/";
const targetUrl = `${upstreamUrl}/json/version`;
const response = await fetch(targetUrl, {
  method: "GET"
});
const json = await response.json();
//const webSocketDebuggerUrl = json.webSocketDebuggerUrl;

const webSocketDebuggerUrl = "ws://playground-api.browser.ihuaj.com/";
const browser = await puppeteer.connect({
  browserWSEndpoint: webSocketDebuggerUrl,
  targetFilter: (target) => { 
  console.log('targetFilter: '+ target.type()); 
  return target.type() === 'page' || target.type() === 'tab' || target.type() === 'browser' ;
}
});

console.log("browser conxtexts 1:", browser.browserContexts());

const page = await browser.newPage();
//await page.goto("about:blank");

const client = await page.target().createCDPSession();
await client.detach();
await sleep(2000);

console.log("browser conxtexts 2:", browser.browserContexts());

console.log("Connected. Now disconnecting...");
await browser.disconnect();
console.log("Disconnected.");