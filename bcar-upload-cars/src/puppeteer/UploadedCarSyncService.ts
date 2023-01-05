// import { mkdir, rm } from "fs/promises"
// import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { BrowserInitializer } from "."
import { DynamoUploadedCarClient } from "../db/dynamo"
// import { AccountSheetClient } from "../sheet"
// import { CarDetailModel, CarModel, CarSegment, CarManufacturer, ManufacturerOrigin } from "../types"
// import { CarObjectFormatter } from "../utils"

export class UploadedCarSyncService {

  constructor(
    private dynamoUploadedCarClient: DynamoUploadedCarClient,
    private initializer: BrowserInitializer,
  ) {}

  async execute() {
    const result = await this.dynamoUploadedCarClient.scanUpdatedCars()
    console.log(result.items);
  }
}
