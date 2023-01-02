import * as puppeteer from "puppeteer"

// 네이밍 변경이 필요하다고 본다. Ex) BrowserController? BrowserManager?
export class BrowserInitializer {
  private _browserList: puppeteer.Browser[] = []

  constructor(private nodeEnv: String){}

  get browserList() {
    return this._browserList
  }
  set browserList(browserList : puppeteer.Browser[]) {
    this._browserList = browserList;
  }

  private createBrowser() {
    return puppeteer.launch({
      defaultViewport: null,
      args: ['--no-sandbox'],
      ignoreDefaultArgs: ['--disable-extensions'],
      headless: this.nodeEnv === 'prod' ? true : false,
    });
  }

  async initializeBrowsers(amount: number) {
    const promisePagesInitialize: Promise<puppeteer.Browser>[] = []
    for (let i = 0; i < amount; i++) {
      const browser = this.createBrowser()
      promisePagesInitialize.push(browser)

    }
    const initializedBrowsers = await Promise.all(promisePagesInitialize)
    this.browserList = this.browserList.concat(initializedBrowsers)
  }

  async closeBrowsers() {
    const promiseClosedBrowsers = this.browserList.map(browser => browser.close());
    await Promise.all(promiseClosedBrowsers)
    console.info(`Total ${promiseClosedBrowsers.length} browser(s) closed`);
  }

  // 이 친구는 여기 없는게 바람직할 것
  async login(page: puppeteer.Page, url: string, id: string, pw: string) {
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.evaluate((id, pw) => {
      // 태그 바뀌어야 함: id, pw 태그를 따로 가져올 것임
      const idInput = document.querySelector('#content > form > fieldset > div.form_inputbox > div:nth-child(1) > input')
      const pwInput = document.querySelector('#content > form > fieldset > div.form_inputbox > div:nth-child(3) > input')
      if (idInput && pwInput) {
        idInput.setAttribute('value', id)
        pwInput.setAttribute('value', pw)
      } else {
        throw new Error("Cannot find id, pw input")
      }
    }, id, pw)

    await page.click("#content > form > fieldset > span > input")
    await page.waitForNavigation({waitUntil: 'networkidle2'})
  }


}
