import { Page, PuppeteerNode } from "puppeteer-core";
import { Environments, CarDetailObject } from "../types"


export class CarDetailCralwer {
  HasSeizure = "HasSeizure"
  HasMortgage = "HasMortgage"
  carInfoKeys = [
    "Category",
    "Displacement",
    "CarNumber",
    "ModelYear",
    "Mileage",
    "Color",
    "GearBox",
    "FuelType",
    "PresentationNumber",
    "HasAccident",
    "RegisterNumber",
    "PresentationsDate",
    this.HasSeizure,
    this.HasMortgage,
  ]
  constructor(private envs: Environments) {}

  private async getBrowser() {
    const chromium = require("chrome-aws-lambda");
    const puppeteer: PuppeteerNode = chromium.puppeteer
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      // headless: true
      headless: chromium.headless
    });
  }

  async crawlRange(manageNums: number[]) {
    const browser = await this.getBrowser()
    try {
      const [page] = await browser.pages();
      let catObjects: CarDetailObject[] = []
      for (let i = 0; i < manageNums.length; i++) {
        const carDetail = await this.getCarDetail(page, manageNums[i])
        catObjects.push(carDetail)
      }
      console.log("done");
      await browser.close()
      return catObjects
    } catch (e) {
      console.log(e);
      throw e
    } finally {
      await browser.close()
    }
  }

  private async getCarInfo(page: Page) {
    let data_len = await page.$$eval( "#detail_box > div.right > div > div.carContTop > ul > li", data => {
      return data.length;
    });

    let promiseCarInfoValues: Promise<string>[] = []
    for (let index = 1; index < data_len+1; index++) {
        promiseCarInfoValues.push(
            page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.txt`, (data)=>{
                return data.textContent ? data.textContent.trim() : ''
            })
        )
    }
    return promiseCarInfoValues
  }

  private async getCarCheckSrc(page: Page) {
    try {
      const carCheckSrc = await page.$eval(`#detail_box > div:nth-child(21) > iframe`, (element)=>{
        return element.getAttribute('src')!
      })
      return carCheckSrc
    } catch (error) {
      console.log("No CheckSrc");
      return ''
    }
  }
  private async getCarImages(page: Page) {
    // 이미지만 가져오기
    const imgLen = await page.$$eval(`#detail_box > div:nth-child(16) > a`, (element)=>{
      return element.length
    })
    const carImgPromiseList = []
    for (let index = 1; index < imgLen+1; index++) {
      carImgPromiseList.push(
            page.$eval(`#detail_box > div:nth-child(16) > a:nth-child(${index}) > img`, (element)=>{
                return element.getAttribute('src')!
            })
        )
    }
    let carImgList: string[] | null = await Promise.all(carImgPromiseList)
    if (carImgList) {
      carImgList = carImgList.filter(img => !img.startsWith('/images/nophoto') )
      carImgList = carImgList.length ? carImgList : null
    }
    return carImgList
  }


  private async getCarDetail(page: Page, manageNum: number) {
    const { BCAR_DETAIL_PAGE_TEMPLATE } = this.envs
    await page.goto(
      `${BCAR_DETAIL_PAGE_TEMPLATE}${manageNum}`,
      // 생각보다 되게 중요한 부분. Timeout Error를 피하기 위해 필요한 부분
      { waitUntil: 'networkidle2', timeout: 0 }
    )

    const promiseCarInfoValues = await this.getCarInfo(page)
    const carInfoValues = await Promise.all(promiseCarInfoValues)
    const [HasSeizure, HasMortgage] = carInfoValues.pop()!.split(' / ')
    const carInfoMap = new Map<string, string|boolean>()
    for (let i = 0; i < carInfoValues.length ; i++) {
      carInfoMap.set(this.carInfoKeys[i], carInfoValues[i])
    }
    carInfoMap.set(this.HasSeizure, HasSeizure === "없음" ? false : true)
    carInfoMap.set(this.HasMortgage, HasMortgage === "없음" ? false : true)

    const carCheckSrc = await this.getCarCheckSrc(page)
    const carImgList = await this.getCarImages(page)

    return {
      carInfoMap : Object.fromEntries(carInfoMap),
      carCheckSrc,
      carImgList
    }
  }
}
