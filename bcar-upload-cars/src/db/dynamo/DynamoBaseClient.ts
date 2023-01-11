
import {
  AttributeValue,
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteRequest,
  DescribeTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteStatementCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  PutRequest,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb"
import { ResponseError } from "../../errors"
import { chunk } from "../../utils/index"

export class DynamoBaseClient {
  client: DynamoDBClient

  constructor(region: string) {
    this.client = new DynamoDBClient({ region })
  }

  describeTable(tableName: string) {
    return this.client.send(new DescribeTableCommand({ TableName: tableName }))
  }

  putItem(input: PutItemCommandInput) {
    return this.client.send(new PutItemCommand(input))
  }

  async scanItems(input: ScanCommandInput) {
    const result = await this.client.send(new ScanCommand(input))
    if (result.$metadata.httpStatusCode !== 200) throw new ResponseError(`${result.$metadata}`)
    return result
  }

  async segmentScan(input: ScanCommandInput) {
    const results: Record<string, AttributeValue>[] = []
    let LastEvaluatedKey: Record<string, AttributeValue> | null = null
    while (true) {
      const result = await this.scanItems(input)

      if (result.$metadata.httpStatusCode !== 200) throw new ResponseError(`${result.$metadata}`)
      if (!result.Items || !result.LastEvaluatedKey) break

      results.concat(result.Items)
      LastEvaluatedKey = result.LastEvaluatedKey
    }
    return results
  }

  queryItems(input: QueryCommandInput) {
    return this.client.send(new QueryCommand(input))
  }

  executeStatement(input: ExecuteStatementCommandInput) {
    return this.client.send(new ExecuteStatementCommand(input))
  }

  batchWriteItem(input: BatchWriteItemCommandInput) {
    return this.client.send(new BatchWriteItemCommand(input))
  }

  deleteItems(input: DeleteItemCommandInput) {
    return this.client.send(new DeleteItemCommand(input))
  }

  batchPutItems(tableName: string, ...putRequestInputs: PutRequest[]) {
    const input = putRequestInputs.map(input=>({ PutRequest: input }))
    const responses = chunk(input, 25).map(putRequests => {
      return this.batchWriteItem({
        RequestItems: {
          [tableName]: putRequests
        }
      })
    })
    return Promise.all(responses)
  }

  batchDeleteItems(tableName: string, ...deleteRequestInputs: DeleteRequest[]) {
    const input = deleteRequestInputs.map(input=>({ DeleteRequest: input }))
    const responses = chunk(input, 25).map(putRequests => {
      return this.batchWriteItem({
        RequestItems: {
          [tableName]: putRequests
        }
      })
    })
    return Promise.all(responses)
  }
}
