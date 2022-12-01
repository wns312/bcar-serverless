import { Page } from "puppeteer-core";
import { CarListPageInitializer } from "./CarListPageInitializer"


export class CarPageAmountCrawler {
  constructor(
    private carListPageInitializer: CarListPageInitializer,
    ) {}

  private async getCarPages(page: Page) {
    const carAmount = await page.$eval<string>('#sellOpenCarCount', (ele) => {
      if (typeof ele.textContent == 'string') {
        return ele.textContent
      }
      throw new Error(`text is not string: ${typeof ele.textContent}`)

    })
    return Math.ceil( (parseInt(carAmount.replace(',', '')) / 100) ) + 1
  }

  async crawl() {
    const { browser, page } = await this.carListPageInitializer.createInitializedBrowsers()
    await page.waitForTimeout(2000)
    const pageAmount = await this.getCarPages(page)
    await browser.close()
    // TODO: 5개씩 쪼개는 range의 경우 제대로 처리되지 않는다. 확인해볼 것
    return pageAmount
  }
}
