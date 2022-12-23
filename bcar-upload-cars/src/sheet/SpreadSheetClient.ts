// https://github.com/googleapis/google-api-nodejs-client/tree/main/samples/sheets
import { google, sheets_v4 } from "googleapis"
import { envs } from "../configs"
import { ResponseError } from "../errors"
import { Account } from "../types"

export class AccountSheetClient {
  static sheetName = envs.GOOGLE_ACCOUNT_SHEET_NAME
  static spreadsheetId = envs.GOOGLE_SPREAD_SHEET_ID
  static rangeStart = "A3"
  static rangeEnd = "F"
  sheets: sheets_v4.Sheets


  constructor(email: string, key: string) {
    const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/spreadsheets"])
    this.sheets = google.sheets({ version: "v4", auth })
  }

  private convertAccounts(accountRawList: string[][]) {
    return accountRawList?.map((rawAccountList) :Account => {
      const isTestAccount = rawAccountList[2] == "TRUE" ? true : false
      const isErrorOccured = rawAccountList[3] == "TRUE" ? true : false
      return {
        id: rawAccountList[0],
        pw: rawAccountList[1],
        isTestAccount,
        isErrorOccured,
        logStreamUrl: isErrorOccured ? rawAccountList[4] : null,
        errorContent: isErrorOccured ? rawAccountList[5] : null,
      }
    })
  }

  async getAccounts() {
    const spreadsheetId = AccountSheetClient.spreadsheetId
    const sheetName = AccountSheetClient.sheetName
    const rangeStart = AccountSheetClient.rangeStart
    const rangeEnd = AccountSheetClient.rangeEnd
    const range = `${sheetName}!${rangeStart}:${rangeEnd}`
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId, range });
    if (response.status != 200) {
      console.error(response);
      throw new ResponseError(response.statusText)
    }
    const values = response.data.values as string[][]
    const accountRawList = values?.splice(1)
    return this.convertAccounts(accountRawList)
  }

  async appendAccount(id: string, pw: string, isTestAccount: boolean) {

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: AccountSheetClient.spreadsheetId,
      range: AccountSheetClient.sheetName,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [ [id, pw, isTestAccount, false] ]
      }
    })
    if (response.status != 200) {
      console.error(response);
      throw new ResponseError(response.statusText)
    }
    return response.data
  }
}
