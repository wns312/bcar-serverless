import { PutRequest } from "@aws-sdk/client-dynamodb";
import { CategoryCrawler } from "."
import { CategoryFormatter } from "../utils"
import { CarManufacturer, CarSegment } from "../types"
import { DynamoClient } from "../db/dynamo/DynamoClient"
import { AccountSheetClient } from "../sheet/index"

export class CategoryService {
  constructor(
    private sheetClient: AccountSheetClient,
    private categoryCrawler: CategoryCrawler,
    private categoryFormatter: CategoryFormatter,
    private dynamoClient: DynamoClient,
  ) {}

  async saveCarSegment(segmentMap: Map<string, CarSegment>) {
    // 1. Segment 저장: PK, SK 지정한 객체를 Item이라는 객체로 감쌈
    const putItems: PutRequest[] = this.categoryFormatter.createSegmentForm(segmentMap)
    const result = await this.dynamoClient.batchPutItems(...putItems)
    result.forEach(r => console.log(r))
  }

  async saveCarManufacturer(carManufacturerMap: Map<string, CarManufacturer>) {
    const putItems: PutRequest[] = this.categoryFormatter.createManufacturerForm(carManufacturerMap)
    const result = await this.dynamoClient.batchPutItems(...putItems)
    result.forEach(r => console.log(r))
  }

  async saveCarModel(companyMap: Map<string, CarManufacturer>) {
    const putItems = this.categoryFormatter.createCarModelForm(companyMap)
    const result = await this.dynamoClient.batchPutItems(...putItems)
    result.forEach(r => console.log(r))
  }

  async saveCarDetailModel(companyMap: Map<string, CarManufacturer>) {
    const putItems = this.categoryFormatter.createCarDetailModelForm(companyMap)
    const result = await this.dynamoClient.batchPutItems(...putItems)
    result.forEach(r => console.log(r))
  }

  async collectCategoryInfo() {
    const accounts = await this.sheetClient.getAccounts()
    const testAccounts = accounts.filter(account => account.isTestAccount)
    if (!testAccounts.length) {
      throw new Error("There is no test account");
    }
    const { id: testId, pw: testPw } = testAccounts[0]

    await this.categoryCrawler.execute(testId, testPw)

    const carManufacturerMap = this.categoryCrawler.carManufacturerMap
    const carSegmentMap = this.categoryCrawler.carSegmentMap

    await this.saveCarSegment(carSegmentMap)
    await this.saveCarManufacturer(carManufacturerMap)
    await this.saveCarModel(carManufacturerMap)
    await this.saveCarDetailModel(carManufacturerMap)

  }
}
