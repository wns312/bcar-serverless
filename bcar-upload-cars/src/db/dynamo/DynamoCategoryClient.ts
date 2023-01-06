import { AttributeValue, PutRequest } from "@aws-sdk/client-dynamodb";
import { CategoryFormatter } from "./formatters"
import { DynamoBaseClient } from "."
import { ResponseError } from "../../errors"
import { CarManufacturer, CarSegment } from "../../types"


type Filter = {
  key: string,
  value: string
}

export class DynamoCategoryClient {
  baseClient: DynamoBaseClient;
  tableName: string;
  indexName: string;

  constructor(region: string, tableName: string, indexName: string) {
    this.baseClient = new DynamoBaseClient(region);
    this.tableName = tableName;
    this.indexName = indexName;
  }

  // baseClient로 아마도 옮겨질 메소드
  private async scanWithStartString(PK: string, SK?: string) {
    const result = await this.baseClient.scanItems({
      TableName: this.tableName,
      FilterExpression: `begins_with(PK, :p) and begins_with(SK, :s)`,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      }
    })

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

  // baseClient로 아마도 옮겨질 메소드
  private async segmentScanWithStartString(
    PK: string,
    segment: number,
    segmentSize: number,
    SK?: string,
    exclusiveStartKey?:Record<string, AttributeValue>,
  ) {
    const FilterExpression = "begins_with(SK, :s) and begins_with(PK, :p)"
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      },
      Segment: segment,
      TotalSegments: segmentSize,
      ExclusiveStartKey: exclusiveStartKey
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }
    let resultObj = {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }

    if (result.LastEvaluatedKey) {
      const additionalItems = await this.segmentScanWithStartString(PK, segment, segmentSize, SK, result.LastEvaluatedKey)
      resultObj.items = [...resultObj.items, ...additionalItems.items]
      resultObj.count += additionalItems.count
    }
    return resultObj
  }

  private async scanWithFilter(PK: string, filter: Filter, SK?: string) {
    let FilterExpression = `begins_with(SK, :s) and begins_with(PK, :p) and ${filter.key} = :${filter.key}`

    let ExpressionAttributeValues =  {
      ":p": { S: PK },
      ":s": { S: SK || PK },
      [`:${filter.key}`]: { S: filter.value },
    }
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression,
      ExpressionAttributeValues
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

  getAllCarSegments() {
    return this.scanWithStartString('#SEGMENT')
  }

  getAllCarCompanies() {
    return this.scanWithStartString('#COMPANY')
  }

  getDomesticCarCompany() {
    return this.scanWithFilter(
      '#COMPANY',
      {
        key: "origin",
        value: "DOMESTIC"
      }
    )
  }
  getImportedCarCompany() {
    return this.scanWithFilter(
      '#COMPANY',
      {
        key: "origin",
        value: "IMPORTED"
      }
    )
  }

  getAllCarModels() {
    return this.scanWithStartString('#MODEL', '#COMPANY')
  }

  getCompanyCarModels(company: string) {
    return this.scanWithFilter(
      '#MODEL',
      {
        key: "company",
        value: company
      },
      '#COMPANY',
    )
  }

  async getAllCarDetails(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.segmentScanWithStartString('#DETAIL', segmentIndex, segmentSize, '#MODEL'))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }

  getCompanyCarDetails(company: string) {
    return this.scanWithFilter(
      '#DETAIL',
      {
        key: "company",
        value: company
      },
      '#MODEL',
    )
  }

  // Category
  async saveCarSegment(segmentMap: Map<string, CarSegment>) {
    // 1. Segment 저장: PK, SK 지정한 객체를 Item이라는 객체로 감쌈
    const putItems: PutRequest[] = CategoryFormatter.createSegmentForm(segmentMap)
    const results = await this.baseClient.batchPutItems(this.tableName, ...putItems)
    return results
  }

  async saveCarManufacturer(carManufacturerMap: Map<string, CarManufacturer>) {
    const putItems: PutRequest[] = CategoryFormatter.createManufacturerForm(carManufacturerMap)
    const results = await this.baseClient.batchPutItems(this.tableName, ...putItems)
    return results
  }

  async saveCarModel(companyMap: Map<string, CarManufacturer>) {
    const putItems = CategoryFormatter.createCarModelForm(companyMap)
    const results = await this.baseClient.batchPutItems(this.tableName, ...putItems)
    return results
  }

  async saveCarDetailModel(companyMap: Map<string, CarManufacturer>) {
    const putItems = CategoryFormatter.createCarDetailModelForm(companyMap)
    const results = await this.baseClient.batchPutItems(this.tableName, ...putItems)
    return results
  }
}

