import { Page } from "puppeteer-core";

export class CarListPageWaiter {
  // 여기서 무한대기 걸릴수도 있음
  async waitForSearchList(page: Page) {
    console.log("waitForSearchList start");

    let display = 'none'
    while (display === 'none') {
      display = await page.$eval('#searchList', ele => {
        return window.getComputedStyle(ele).getPropertyValue('display')
      })
    }
    await page.waitForSelector('#searchList');
    console.log("waitForSearchList end");
  }
}
