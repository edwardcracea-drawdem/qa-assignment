import { APIRequestContext, APIResponse } from '@playwright/test';

export interface Book {
  isbn: string;
  title: string;
  subTitle: string;
  author: string;
  publish_date: string;
  publisher: string;
  pages: number;
  description: string;
  website: string;
}

export interface BookStoreUser {
  userId: string;
  userName: string;
  password: string;
  token: string;
}

/**
 * Thin typed client over the demoqa Account and BookStore endpoints.
 *
 * The registration UI is behind reCAPTCHA, so test users are provisioned
 * through this client instead. One behavioural quirk discovered while
 * exploring the SUT: logging in through the UI invalidates previously
 * issued API tokens, so callers that mix UI sessions and API calls must
 * call generateToken() again before any authorised request (deleteUser()
 * does this internally).
 */
export class BookStoreApi {
  constructor(private readonly request: APIRequestContext) {}

  async createUser(userName: string, password: string): Promise<{ userId: string }> {
    const res = await this.request.post('/Account/v1/User', { data: { userName, password } });
    if (res.status() !== 201) {
      throw new Error(`User creation failed: ${res.status()} ${await res.text()}`);
    }
    const body = await res.json();
    return { userId: body.userID };
  }

  /** Raw variant used by negative tests that assert on the error response. */
  createUserRaw(userName: string, password: string): Promise<APIResponse> {
    return this.request.post('/Account/v1/User', { data: { userName, password } });
  }

  async generateToken(userName: string, password: string): Promise<string> {
    const res = await this.request.post('/Account/v1/GenerateToken', { data: { userName, password } });
    const body = await res.json();
    if (body.status !== 'Success' || !body.token) {
      throw new Error(`Token generation failed: ${JSON.stringify(body)}`);
    }
    return body.token;
  }

  generateTokenRaw(userName: string, password: string): Promise<APIResponse> {
    return this.request.post('/Account/v1/GenerateToken', { data: { userName, password } });
  }

  async deleteUser(user: Pick<BookStoreUser, 'userId' | 'userName' | 'password'>): Promise<void> {
    // Always work with a fresh token: a UI login during the test has
    // usually invalidated the one issued at setup time.
    const token = await this.generateToken(user.userName, user.password);
    const res = await this.request.delete(`/Account/v1/User/${user.userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() !== 204) {
      throw new Error(`User deletion failed: ${res.status()} ${await res.text()}`);
    }
  }

  async getBooks(): Promise<Book[]> {
    const res = await this.request.get('/BookStore/v1/Books');
    if (res.status() !== 200) {
      throw new Error(`Books fetch failed: ${res.status()}`);
    }
    return (await res.json()).books;
  }

  getBooksRaw(): Promise<APIResponse> {
    return this.request.get('/BookStore/v1/Books');
  }

  getBookRaw(isbn: string): Promise<APIResponse> {
    return this.request.get(`/BookStore/v1/Book?ISBN=${isbn}`);
  }

  addBooks(token: string, userId: string, isbns: string[]): Promise<APIResponse> {
    return this.request.post('/BookStore/v1/Books', {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId, collectionOfIsbns: isbns.map((isbn) => ({ isbn })) },
    });
  }

  async deleteAllBooks(token: string, userId: string): Promise<void> {
    const res = await this.request.delete(`/BookStore/v1/Books?UserId=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() !== 204) {
      throw new Error(`Collection cleanup failed: ${res.status()}`);
    }
  }
}
