import { Page, PuppeteerNode } from "puppeteer-core";
import { CarListPageWaiter } from "./CarListPageWaiter"
import { Environments } from "../types"

export class CarListPageInitializer {
  constructor(
    private envs: Environments,
    private carListPageWaiter: CarListPageWaiter) {}

  private async login(page: Page) {
    const {
      BCAR_ADMIN_LOGIN_PAGE,
      ADMIN_ID,
      ADMIN_PW
    } = this.envs

    await page.goto(BCAR_ADMIN_LOGIN_PAGE, { waitUntil: 'load' });
    await page.evaluate((id, pw) => {
      const elements = document.getElementsByClassName('iptD')
      const idInput = elements[0]
      const pwInput = elements[1]
      idInput.setAttribute('value', id)
      pwInput.setAttribute('value', pw)
    }, ADMIN_ID, ADMIN_PW)
    await Promise.all([
      page.click('button[class="btn_login"]'),
      page.waitForNavigation({waitUntil: 'networkidle2'})
    ]);
    // await page.waitForTimeout(3000);
  }
  // 차량 가격 필터링 중 최대 가격 필터링을 적용 후 페이지를 이동한 뒤 로딩될 때까지 대기한다
  private async selectCarsWithMaxPrice(page: Page, maxPrice: number) {
    await page.select('select[name="c_price2"]', `${maxPrice}`);
    await page.click('input[value="검색"]')
    await this.carListPageWaiter.waitForSearchList(page)
  }

  private async getBrowser() {
    const chromium = require("chrome-aws-lambda");
    const puppeteer: PuppeteerNode = chromium.puppeteer
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true
      // headless: chromium.headless
    });
  }

  async createInitializedBrowsers() {
    const browser = await this.getBrowser()
    const [page] = await browser.pages()
    await this.login(page)
    await this.selectCarsWithMaxPrice(page, 2000)

    return {
      browser,
      page
    }
  }
}
