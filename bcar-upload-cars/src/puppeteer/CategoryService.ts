import { CategoryCrawler } from "."
import { DynamoClient } from "../db/dynamo/DynamoClient"
import { AccountSheetClient } from "../sheet/index"

export class CategoryService {
  constructor(
    private sheetClient: AccountSheetClient,
    private categoryCrawler: CategoryCrawler,
    private dynamoClient: DynamoClient,
  ) {}


  async collectCategoryInfo(loginUrl: string, registerUrl: string) {
    const { id: testId, pw: testPw } = await this.sheetClient.getTestAccount()

    await this.categoryCrawler.execute(testId, testPw, loginUrl, registerUrl)

    const carManufacturerMap = this.categoryCrawler.carManufacturerMap
    const carSegmentMap = this.categoryCrawler.carSegmentMap

    const carSegmentResult = await this.dynamoClient.saveCarSegment(carSegmentMap)
    const carManufacturerResult = await this.dynamoClient.saveCarManufacturer(carManufacturerMap)
    const carModelResult = await this.dynamoClient.saveCarModel(carManufacturerMap)
    const carDetailResult = await this.dynamoClient.saveCarDetailModel(carManufacturerMap)

    carSegmentResult.forEach(r => console.log(r))
    carManufacturerResult.forEach(r => console.log(r))
    carModelResult.forEach(r => console.log(r))
    carDetailResult.forEach(r => console.log(r))

  }
}
