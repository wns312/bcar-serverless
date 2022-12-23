import { Page } from "puppeteer"

import { Environments } from "../types"
import { BrowserInitializer } from "."
import { DynamoClient } from "../db/dynamo/DynamoClient"
import { AccountSheetClient } from "../sheet/index"

// 여기는 이제 class로 변경되어야 하며, browser를 리턴하는 코드와 execution 코드를 분리하는것이 좋다.
// 외부에서 try-catch를 하기 위함
// 디테일한 부분에 대해서는 고민좀 해볼 것

export class CarUploader {

  constructor(
    private sheetClient: AccountSheetClient,
    private initializer: BrowserInitializer,
    private dynamoClient: DynamoClient,
    private envs: Environments
  ) {}

  private async fileUploadTest(page: Page) {
    const promiseFileChooser = page.waitForFileChooser()
    const [fileChooser] = await Promise.all([
      promiseFileChooser,
      page.click("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    ])

    await fileChooser.accept( [ "tmp/test_img.png" ] );
  }

  async execute(page: Page) {
    const{ BCAR_ANSAN_CROSS_LOGIN_URL, BCAR_ANSAN_CROSS_CAR_REGISTER_URL } = this.envs
    const url = BCAR_ANSAN_CROSS_LOGIN_URL! + BCAR_ANSAN_CROSS_CAR_REGISTER_URL!
    const id = "" // 스프레드 시트에서 가져온다
    const pw = "" // 스프레드 시트에서 가져온다
    // await this.initializer.login(page, url, id, pw)
    // await page.waitForSelector("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    // // 1-2 파일업로드
    // await this.fileUploadTest(page)

    // 조건부 스캔이 필요하다. 테스트 유저는 존재하지 않음
    // 1. 이미 등록된 차량은 제거해야 한다. (쿼리로 가능할 것인가?)
    //   -> 아마도 인덱스로 검색한 뒤 map에 넣고 직접 파악해야 할 것 같음.
    // 2. 이미 등록된 차량을 제거한 뒤, 이 차량들을 각 계정에 적절하게 분배해야한다.
    // 3. 이제 각 계정을 데이터베이스에 저장해야한다.
    // 4. 메인 로직을 작성 (인자로 차량과 계정 정보를 받아서 함수를 실행한다)
    const cars = await this.dynamoClient.getAllCars(10)
    console.log(cars.items)
    console.log(cars.count)
    // 계정을 DB에 넣어야 한다. -> 환경변수로 들어가 있는 계정을 DB에 우선 저장하고 확인해볼 것
    const result = await new Promise((resolve, reject)=>{
      setTimeout(()=>{
        resolve("resolved")
      }, 5000)
    })
    console.log(result);

  }
}
