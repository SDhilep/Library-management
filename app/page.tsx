"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../utils/supabase/client';

type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  status: 'Available' | 'Issued';
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  membership: 'Standard' | 'Silver' | 'Gold';
};

type Transaction = {
  id: string;
  customerId: string;
  bookId: string;
  action: 'Issue' | 'Return';
  timestamp: string;
};

type LibraryData = {
  books: Book[];
  customers: Customer[];
  transactions: Transaction[];
};

const defaultData: LibraryData = {
  books: [],
  customers: [],
  transactions: [],
};

export default function Page() {
  const supabase = createClient();
  const [theme, setTheme] = useState<'default' | 'light' | 'dark'>('default');

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('library-theme') as 'default' | 'light' | 'dark' | null;
    if (savedTheme && ['default', 'light', 'dark'].includes(savedTheme)) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'default');
    }
  }, []);

  const handleThemeChange = (newTheme: 'default' | 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('library-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const [activeTab, setActiveTab] = useState<'books' | 'customers' | 'transactions'>('books');
  const [data, setData] = useState<LibraryData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [booksResult, customersResult, transactionsResult] = await Promise.all([
        supabase.from('books').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('timestamp', { ascending: false }),
      ]);

      if (booksResult.error) throw booksResult.error;
      if (customersResult.error) throw customersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const mappedTransactions = (transactionsResult.data ?? []).map((tx: any) => ({
        id: tx.id,
        customerId: tx.customer_id,
        bookId: tx.book_id,
        action: tx.action,
        timestamp: tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '',
      }));

      setData({
        books: booksResult.data ?? [],
        customers: customersResult.data ?? [],
        transactions: mappedTransactions,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch library data.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentBook = useMemo(
    () => data.books.find((book) => book.id === editingBookId) ?? null,
    [data.books, editingBookId],
  );

  const currentCustomer = useMemo(
    () => data.customers.find((customer) => customer.id === editingCustomerId) ?? null,
    [data.customers, editingCustomerId],
  );

  const [bookForm, setBookForm] = useState({ title: '', author: '', genre: '', status: 'Available' as Book['status'] });
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', membership: 'Standard' as Customer['membership'] });
  const [transactionForm, setTransactionForm] = useState({ customerId: '', bookId: '', action: 'Issue' as Transaction['action'] });

  useEffect(() => {
    if (currentBook) {
      setBookForm({
        title: currentBook.title,
        author: currentBook.author,
        genre: currentBook.genre,
        status: currentBook.status,
      });
    } else {
      setBookForm({ title: '', author: '', genre: '', status: 'Available' });
    }
  }, [currentBook]);

  useEffect(() => {
    if (currentCustomer) {
      setCustomerForm({
        name: currentCustomer.name,
        email: currentCustomer.email,
        phone: currentCustomer.phone,
        membership: currentCustomer.membership,
      });
    } else {
      setCustomerForm({ name: '', email: '', phone: '', membership: 'Standard' });
    }
  }, [currentCustomer]);

  useEffect(() => {
    setTransactionForm((current) => ({
      ...current,
      customerId: data.customers[0]?.id ?? '',
      bookId: data.books[0]?.id ?? '',
    }));
  }, [data.books, data.customers]);

  const visibleTransactions = useMemo(
    () =>
      data.transactions.map((transaction) => ({
        ...transaction,
        customer: data.customers.find((customer) => customer.id === transaction.customerId),
        book: data.books.find((book) => book.id === transaction.bookId),
      })),
    [data.transactions, data.customers, data.books],
  );

  const handleBookSave = async () => {
    if (!bookForm.title || !bookForm.author || !bookForm.genre) {
      setFormMessage('Please fill in title, author, and genre.');
      return;
    }

    try {
      if (editingBookId) {
        const { error: err } = await supabase
          .from('books')
          .update({
            title: bookForm.title,
            author: bookForm.author,
            genre: bookForm.genre,
            status: bookForm.status,
          })
          .eq('id', editingBookId);
        if (err) throw err;
        setFormMessage('Book updated.');
      } else {
        const { error: err } = await supabase
          .from('books')
          .insert({
            title: bookForm.title,
            author: bookForm.author,
            genre: bookForm.genre,
            status: bookForm.status,
          });
        if (err) throw err;
        setFormMessage('Book saved.');
      }
      setEditingBookId(null);
      setBookForm({ title: '', author: '', genre: '', status: 'Available' });
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  const handleCustomerSave = async () => {
    if (!customerForm.name || !customerForm.email || !customerForm.phone) {
      setFormMessage('Please fill in the customer name, email, and phone.');
      return;
    }

    try {
      if (editingCustomerId) {
        const { error: err } = await supabase
          .from('customers')
          .update({
            name: customerForm.name,
            email: customerForm.email,
            phone: customerForm.phone,
            membership: customerForm.membership,
          })
          .eq('id', editingCustomerId);
        if (err) throw err;
        setFormMessage('Customer updated.');
      } else {
        const { error: err } = await supabase
          .from('customers')
          .insert({
            name: customerForm.name,
            email: customerForm.email,
            phone: customerForm.phone,
            membership: customerForm.membership,
          });
        if (err) throw err;
        setFormMessage('Customer saved.');
      }
      setEditingCustomerId(null);
      setCustomerForm({ name: '', email: '', phone: '', membership: 'Standard' });
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  const handleTransactionSave = async () => {
    if (!transactionForm.customerId || !transactionForm.bookId) {
      setFormMessage('Please select a customer and a book.');
      return;
    }

    const book = data.books.find((item) => item.id === transactionForm.bookId);
    if (!book) {
      setFormMessage('Selected book was not found.');
      return;
    }

    if (transactionForm.action === 'Issue' && book.status === 'Issued') {
      setFormMessage('Book is already issued.');
      return;
    }
    if (transactionForm.action === 'Return' && book.status === 'Available') {
      setFormMessage('Book is already available.');
      return;
    }

    try {
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          customer_id: transactionForm.customerId,
          book_id: transactionForm.bookId,
          action: transactionForm.action,
        });
      if (txErr) throw txErr;

      const { error: bookErr } = await supabase
        .from('books')
        .update({
          status: transactionForm.action === 'Issue' ? 'Issued' : 'Available',
        })
        .eq('id', transactionForm.bookId);
      if (bookErr) throw bookErr;

      setFormMessage('Transaction saved.');
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  const removeBook = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('books')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setFormMessage('Book deleted.');
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  const removeCustomer = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setFormMessage('Customer deleted.');
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  return (
    <main className="library-shell">
      <header className="header-bar">
        <div className="logo-section">
          <span className="logo-icon">📚</span>
          <span className="logo-text">LibFlow</span>
        </div>
        <div className="theme-control">
          <span>Theme:</span>
          <select
            className="theme-select"
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as 'default' | 'light' | 'dark')}
          >
            <option value="default">default</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </div>
      </header>

      <div className="page-header">
        <h1 className="page-title">LIBRARY MANAGEMENT</h1>
      </div>

      <div className="tabs" role="tablist">
        {['books', 'customers', 'transactions'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'tab active' : 'tab'}
            onClick={() => {
              setActiveTab(tab as 'books' | 'customers' | 'transactions');
              setFormMessage('');
            }}
          >
            {tab === 'books' ? 'Books' : tab === 'customers' ? 'Customers' : 'Issue / Return'}
          </button>
        ))}
      </div>

      {formMessage && <div className="toast">{formMessage}</div>}

      {isLoading ? (
        <div className="empty" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #3b82f6', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          Loading data from Supabase...
        </div>
      ) : error ? (
        <div className="empty" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.08)' }}>
          <h3>Failed to load database</h3>
          <p>{error}</p>
          <button type="button" onClick={fetchData} style={{ marginTop: '0.5rem' }}>Retry</button>
        </div>
      ) : (
        <>
          {activeTab === 'books' && (
            <div className="grid">
              <section className="panel">
                <h2>{editingBookId ? 'Edit book' : 'Add book'}</h2>
                <label>
                  Title
                  <input
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  />
                </label>
                <label>
                  Author
                  <input
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  />
                </label>
                <label>
                  Genre
                  <input
                    value={bookForm.genre}
                    onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={bookForm.status}
                    onChange={(e) => setBookForm({ ...bookForm, status: e.target.value as Book['status'] })}
                  >
                    <option value="Available">Available</option>
                    <option value="Issued">Issued</option>
                  </select>
                </label>
                <div className="actions">
                  <button type="button" onClick={handleBookSave}>
                    {editingBookId ? 'Update book' : 'Save book'}
                  </button>
                  {editingBookId && (
                    <button type="button" className="secondary" onClick={() => setEditingBookId(null)}>
                      Cancel
                    </button>
                  )}
                </div>
              </section>

              <section className="panel list-panel">
                <div className="panel-header">
                  <h2>Book catalog</h2>
                  <span>{data.books.length} books</span>
                </div>
                {data.books.length === 0 ? (
                  <div className="empty">No books added yet.</div>
                ) : (
                  data.books.map((book) => (
                    <article key={book.id} className="item-card">
                      <div>
                        <strong>{book.title}</strong>
                        <p>{book.author} · {book.genre}</p>
                        <span className={book.status === 'Issued' ? 'badge issued' : 'badge available'}>{book.status}</span>
                      </div>
                      <div className="item-actions">
                        <button type="button" onClick={() => setEditingBookId(book.id)}>
                          Edit
                        </button>
                        <button type="button" className="secondary" onClick={() => removeBook(book.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="grid">
              <section className="panel">
                <h2>{editingCustomerId ? 'Edit customer' : 'Add customer'}</h2>
                <label>
                  Name
                  <input
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </label>
                <label>
                  Membership
                  <select
                    value={customerForm.membership}
                    onChange={(e) => setCustomerForm({ ...customerForm, membership: e.target.value as Customer['membership'] })}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                  </select>
                </label>
                <div className="actions">
                  <button type="button" onClick={handleCustomerSave}>
                    {editingCustomerId ? 'Update customer' : 'Save customer'}
                  </button>
                  {editingCustomerId && (
                    <button type="button" className="secondary" onClick={() => setEditingCustomerId(null)}>
                      Cancel
                    </button>
                  )}
                </div>
              </section>

              <section className="panel list-panel">
                <div className="panel-header">
                  <h2>Customers</h2>
                  <span>{data.customers.length} members</span>
                </div>
                {data.customers.length === 0 ? (
                  <div className="empty">No customers added yet.</div>
                ) : (
                  data.customers.map((customer) => (
                    <article key={customer.id} className="item-card">
                      <div>
                        <strong>{customer.name}</strong>
                        <p>{customer.email} · {customer.phone}</p>
                        <span className="badge">{customer.membership}</span>
                      </div>
                      <div className="item-actions">
                        <button type="button" onClick={() => setEditingCustomerId(customer.id)}>
                          Edit
                        </button>
                        <button type="button" className="secondary" onClick={() => removeCustomer(customer.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="grid single-column">
              <section className="panel">
                <h2>Issue / return book</h2>
                <label>
                  Customer
                  <select
                    value={transactionForm.customerId}
                    onChange={(e) => setTransactionForm({ ...transactionForm, customerId: e.target.value })}
                  >
                    <option value="">Select customer</option>
                    {data.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Book
                  <select
                    value={transactionForm.bookId}
                    onChange={(e) => setTransactionForm({ ...transactionForm, bookId: e.target.value })}
                  >
                    <option value="">Select book</option>
                    {data.books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} ({book.status})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Action
                  <select
                    value={transactionForm.action}
                    onChange={(e) => setTransactionForm({ ...transactionForm, action: e.target.value as Transaction['action'] })}
                  >
                    <option value="Issue">Issue</option>
                    <option value="Return">Return</option>
                  </select>
                </label>
                <div className="actions">
                  <button type="button" onClick={handleTransactionSave}>
                    Save transaction
                  </button>
                </div>
              </section>

              <section className="panel list-panel">
                <div className="panel-header">
                  <h2>Transaction history</h2>
                  <span>{data.transactions.length} records</span>
                </div>
                {data.transactions.length === 0 ? (
                  <div className="empty">No transactions yet.</div>
                ) : (
                  visibleTransactions.map((entry) => (
                    <article key={entry.id} className="item-card transaction-card">
                      <div>
                        <strong>{entry.action}</strong>
                        <p>{entry.customer?.name ?? 'Unknown customer'} · {entry.book?.title ?? 'Unknown book'}</p>
                        <span>{entry.timestamp}</span>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
