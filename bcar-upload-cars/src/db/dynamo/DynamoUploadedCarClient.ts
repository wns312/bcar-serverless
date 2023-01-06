import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoBaseClient } from "."
import { ResponseError } from "../../errors"
import { UploadSource } from "../../types"

export class DynamoUploadedCarClient {
  baseClient: DynamoBaseClient;
  tableName: string;
  indexName: string;

  constructor(region: string, tableName: string, indexName: string) {
    this.baseClient = new DynamoBaseClient(region);
    this.tableName = tableName;
    this.indexName = indexName;
  }
  // baseClient로 아마도 옮겨질 메소드
  // 이거 재귀호출이면 안됨. 어차피 LastEvaluatedKey로 순차 조회할 것이므로 그냥 리턴하고 다시 호출이 되어야 함
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

  // PK만 필수고, 나머지는 옵션으로 들어가는것이 맞음
  // 옵션은 별도의 객체로 나오는 것이 맞다.
  // private async scanWithStartString(PK: string, SK?: string) {
  //   const result = await this.baseClient.scanItems({
  //     TableName: this.tableName,
  //     FilterExpression: `begins_with(PK, :p) and begins_with(SK, :s)`,
  //     ExpressionAttributeValues: {
  //       ":p": { S: PK },
  //       ":s": { S: SK || PK },
  //     }
  //   })

  //   if (result.$metadata.httpStatusCode !== 200) {
  //     throw new ResponseError(`${result.$metadata}`)
  //   }

  //   return {
  //     items: result.Items ? result.Items : [],
  //     count: result.Count!
  //   }
  // }

  async scanUpdatedCars(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.segmentScanWithStartString('#USER', segmentIndex, segmentSize, '#CAR'))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }

  async saveUpdatedCars(id: string, updatedSources: UploadSource[]) {
    const now = Date.now()
    const putItems = updatedSources.map(s=>({
      Item: {
        PK: { S: `#USER-${id}` },
        SK: { S: `#CAR-${s.car.carNumber}` },
        registeredAt: { N: now.toString() },
      }
    }))

    const results = await this.baseClient.batchPutItems(this.tableName, ...putItems)
    return results
  }
}
