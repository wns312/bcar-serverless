import * as puppeteer from "puppeteer"
import { Environments } from "../types"


export class BrowserInitializer {

  constructor(private envs: Environments){}

  createBrowser() {
    const { NODE_ENV } = this.envs
    return puppeteer.launch({
      defaultViewport: null,
      args: ['--no-sandbox'],
      ignoreDefaultArgs: ['--disable-extensions'],
      headless: NODE_ENV === 'prod' ? true : false,
    });
  }

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
