import { Page } from "puppeteer"

import { Environments } from "../types"

import { BrowserInitializer } from "."
// 여기는 이제 class로 변경되어야 하며, browser를 리턴하는 코드와 execution 코드를 분리하는것이 좋다.
// 외부에서 try-catch를 하기 위함
// 디테일한 부분에 대해서는 고민좀 해볼 것

export class CarUploader {

  constructor(private initializer: BrowserInitializer, private envs: Environments) {}

  private async fileUploadTest(page: Page) {
    const promiseFileChooser = page.waitForFileChooser()
    const [fileChooser] = await Promise.all([
      promiseFileChooser,
      page.click("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    ])

    await fileChooser.accept( [ "tmp/test_img.png" ] );
  }

  async execute(page: Page) {
    const{ BCAR_ANSAN_CROSS_LOGIN_URL, BCAR_ANSAN_CROSS_CAR_REGISTER_URL, TMP_ID, TMP_PW } = this.envs
    const url = BCAR_ANSAN_CROSS_LOGIN_URL! + BCAR_ANSAN_CROSS_CAR_REGISTER_URL!

    await this.initializer.login(page, url, TMP_ID, TMP_PW)
    await page.waitForSelector("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    // 1-2 파일업로드
    await this.fileUploadTest(page)


    const result = await new Promise((resolve, reject)=>{
      setTimeout(()=>{
        resolve("resolved")
      }, 5000)
    })
    console.log(result);

  }
}
