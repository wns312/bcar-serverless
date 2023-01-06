import { CategoryCrawler } from "../puppeteer"
import { AccountSheetClient, DynamoCategoryClient } from "../db"

export class CategoryService {
  constructor(
    private sheetClient: AccountSheetClient,
    private categoryCrawler: CategoryCrawler,
    private dynamoCategoryClient: DynamoCategoryClient,
  ) {}


  async collectCategoryInfo(loginUrl: string, registerUrl: string) {
    const { id: testId, pw: testPw } = await this.sheetClient.getTestAccount()

    await this.categoryCrawler.execute(testId, testPw, loginUrl, registerUrl)

    const carManufacturerMap = this.categoryCrawler.carManufacturerMap
    const carSegmentMap = this.categoryCrawler.carSegmentMap

    const carSegmentResult = await this.dynamoCategoryClient.saveCarSegment(carSegmentMap)
    const carManufacturerResult = await this.dynamoCategoryClient.saveCarManufacturer(carManufacturerMap)
    const carModelResult = await this.dynamoCategoryClient.saveCarModel(carManufacturerMap)
    const carDetailResult = await this.dynamoCategoryClient.saveCarDetailModel(carManufacturerMap)

    carSegmentResult.forEach(r => console.log(r))
    carManufacturerResult.forEach(r => console.log(r))
    carModelResult.forEach(r => console.log(r))
    carDetailResult.forEach(r => console.log(r))

  }
}
