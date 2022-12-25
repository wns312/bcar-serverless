import { Page } from "puppeteer"
import { BrowserInitializer } from "."
import { DynamoClient } from "../db/dynamo/DynamoClient"

// id별로 결제된 교차로가 다르기 때무에 login url은 몰라도 redirect될 register url은 주입받아야함.
// 결론만 말해서 login url과 register url은 둘 다 주입받아야 함
export class CarUploader {

  constructor(
    private initializer: BrowserInitializer,
    private dynamoClient: DynamoClient,
  ) {}

  private async fileUploadTest(page: Page) {
    const promiseFileChooser = page.waitForFileChooser()
    const [fileChooser] = await Promise.all([
      promiseFileChooser,
      page.click("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    ])

    await fileChooser.accept( [ "tmp/test_img.png" ] );
  }

  async execute(id: string, pw: string, loginUrl: string, registerUrl: string) {
    await this.initializer.initializeBrowsers(1)
    const page = await this.initializer.browserList[0].newPage()
    const url = loginUrl! + registerUrl!
    const carsPromise = this.dynamoClient.getAllCars(10)



    await this.initializer.login(page, url, id, pw)
    await page.waitForSelector("#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)")
    // // 1-2 파일업로드
    await this.fileUploadTest(page)

    // 조건부 스캔이 필요하다. 테스트 유저는 존재하지 않음
    // 1. 이미 등록된 차량은 제거해야 한다. (쿼리로 가능할 것인가?)
    //   -> 아마도 인덱스로 검색한 뒤 map에 넣고 직접 파악해야 할 것 같음.
    // 2. 이미 등록된 차량을 제거한 뒤, 이 차량들을 각 계정에 적절하게 분배해야한다.
    // 3. 이제 각 계정을 데이터베이스에 저장해야한다.
    // 4. 메인 로직을 작성 (인자로 차량과 계정 정보를 받아서 함수를 실행한다)
    const cars = await carsPromise
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
