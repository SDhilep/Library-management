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

const formatTimestamp = (isoString: string | null) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString();
  } catch (e) {
    return isoString;
  }
};

const getDurationString = (issuedAtStr: string | null, returnedAtStr: string | null) => {
  if (!issuedAtStr) return '';
  const start = new Date(issuedAtStr);
  const end = returnedAtStr ? new Date(returnedAtStr) : new Date();
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return '';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}${returnedAtStr ? '' : ' active'}`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}${returnedAtStr ? '' : ' active'}`;
  }
  return `${diffMins} min${diffMins > 1 ? 's' : ''}${returnedAtStr ? '' : ' active'}`;
};

const formatForDateTimeLocal = (dateStr: string | null) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return '';
  }
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

  const handleCustomerClick = (customerId: string) => {
    setActiveTab('customers');
    setTimeout(() => {
      const el = document.getElementById(`customer-card-${customerId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-flash');
        setTimeout(() => el.classList.remove('highlight-flash'), 2000);
      }
    }, 100);
  };

  const [activeTab, setActiveTab] = useState<'books' | 'customers' | 'transactions' | 'history'>('books');
  const [data, setData] = useState<LibraryData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState('');

  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editTxForm, setEditTxForm] = useState({
    customerId: '',
    bookId: '',
    issuedAt: '',
    returnedAt: '',
    isReturned: false,
  });
  const [expandedCustomerHistory, setExpandedCustomerHistory] = useState<{ [customerId: string]: boolean }>({});

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
        timestamp: tx.timestamp ?? '',
      }));

      const membershipOrder: Record<'Gold' | 'Silver' | 'Standard', number> = {
        Gold: 1,
        Silver: 2,
        Standard: 3,
      };

      const sortedCustomers = (customersResult.data ?? []).sort((a: any, b: any) => {
        const orderA = membershipOrder[a.membership as 'Gold' | 'Silver' | 'Standard'] ?? 99;
        const orderB = membershipOrder[b.membership as 'Gold' | 'Silver' | 'Standard'] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setData({
        books: booksResult.data ?? [],
        customers: sortedCustomers,
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

  const groupedTransactions = useMemo(() => {
    const sorted = [...data.transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const grouped: Array<{
      id: string;
      issueTxId: string | null;
      returnTxId: string | null;
      customerId: string;
      bookId: string;
      issuedAt: string | null;
      returnedAt: string | null;
    }> = [];

    const activeBorrows: { [key: string]: typeof grouped[number] } = {};

    for (const tx of sorted) {
      const key = `${tx.customerId}_${tx.bookId}`;
      if (tx.action === 'Issue') {
        const record = {
          id: tx.id,
          issueTxId: tx.id,
          returnTxId: null as string | null,
          customerId: tx.customerId,
          bookId: tx.bookId,
          issuedAt: tx.timestamp,
          returnedAt: null as string | null,
        };
        grouped.push(record);
        activeBorrows[key] = record;
      } else if (tx.action === 'Return') {
        const active = activeBorrows[key];
        if (active && !active.returnedAt) {
          active.returnedAt = tx.timestamp;
          active.returnTxId = tx.id;
          delete activeBorrows[key];
        } else {
          const record = {
            id: tx.id,
            issueTxId: null as string | null,
            returnTxId: tx.id,
            customerId: tx.customerId,
            bookId: tx.bookId,
            issuedAt: null as string | null,
            returnedAt: tx.timestamp,
          };
          grouped.push(record);
        }
      }
    }

    return grouped.reverse();
  }, [data.transactions]);

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

  const toggleCustomerHistory = (customerId: string) => {
    setExpandedCustomerHistory((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  const removeTransaction = async (entry: any) => {
    if (!confirm('Are you sure you want to delete this transaction record?')) return;
    try {
      const idsToDelete = [entry.issueTxId, entry.returnTxId].filter((id): id is string => !!id);
      if (idsToDelete.length > 0) {
        const { error: err } = await supabase
          .from('transactions')
          .delete()
          .in('id', idsToDelete);
        if (err) throw err;
      }

      // If it was an active borrow (not returned), reset the book status to Available
      if (!entry.returnedAt) {
        const { error: bookErr } = await supabase
          .from('books')
          .update({ status: 'Available' })
          .eq('id', entry.bookId);
        if (bookErr) throw bookErr;
      }

      setFormMessage('Transaction record deleted.');
      fetchData();
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  };

  const startEditTransaction = (entry: any) => {
    setEditingTransaction(entry);
    setEditTxForm({
      customerId: entry.customerId,
      bookId: entry.bookId,
      issuedAt: formatForDateTimeLocal(entry.issuedAt),
      returnedAt: formatForDateTimeLocal(entry.returnedAt),
      isReturned: !!entry.returnedAt,
    });
  };

  const handleEditTransactionSave = async () => {
    if (!editingTransaction) return;
    try {
      // 1. Update the Issue transaction
      if (editingTransaction.issueTxId) {
        const { error: issueErr } = await supabase
          .from('transactions')
          .update({
            customer_id: editTxForm.customerId,
            book_id: editTxForm.bookId,
            timestamp: editTxForm.issuedAt ? new Date(editTxForm.issuedAt).toISOString() : null,
          })
          .eq('id', editingTransaction.issueTxId);
        if (issueErr) throw issueErr;
      }

      // 2. Handle Return transaction
      if (editTxForm.isReturned) {
        if (editingTransaction.returnTxId) {
          const { error: returnErr } = await supabase
            .from('transactions')
            .update({
              customer_id: editTxForm.customerId,
              book_id: editTxForm.bookId,
              timestamp: editTxForm.returnedAt ? new Date(editTxForm.returnedAt).toISOString() : null,
            })
            .eq('id', editingTransaction.returnTxId);
          if (returnErr) throw returnErr;
        } else {
          const { error: returnErr } = await supabase
            .from('transactions')
            .insert({
              customer_id: editTxForm.customerId,
              book_id: editTxForm.bookId,
              action: 'Return',
              timestamp: editTxForm.returnedAt ? new Date(editTxForm.returnedAt).toISOString() : new Date().toISOString(),
            });
          if (returnErr) throw returnErr;
        }
      } else if (editingTransaction.returnTxId) {
        const { error: delErr } = await supabase
          .from('transactions')
          .delete()
          .eq('id', editingTransaction.returnTxId);
        if (delErr) throw delErr;
      }

      // 3. Update book statuses
      if (editingTransaction.bookId !== editTxForm.bookId) {
        await supabase.from('books').update({ status: 'Available' }).eq('id', editingTransaction.bookId);
      }
      
      const newStatus = editTxForm.isReturned ? 'Available' : 'Issued';
      const { error: bookErr } = await supabase
        .from('books')
        .update({ status: newStatus })
        .eq('id', editTxForm.bookId);
      if (bookErr) throw bookErr;

      setFormMessage('Transaction updated successfully.');
      setEditingTransaction(null);
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
          <span className="logo-text">Smart Library</span>
        </div>
        <div className="theme-control">
          <span>Theme:</span>
          <select
            className="theme-select"
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as 'default' | 'light' | 'dark')}
          >
            <option value="default">Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>

      <div className="page-header">
        <h1 className="page-title">LIBRARY MANAGEMENT</h1>
      </div>

      <div className="tabs" role="tablist">
        {['books', 'customers', 'transactions', 'history'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'tab active' : 'tab'}
            onClick={() => {
              setActiveTab(tab as 'books' | 'customers' | 'transactions' | 'history');
              setFormMessage('');
            }}
          >
            {tab === 'books'
              ? 'Books'
              : tab === 'customers'
              ? 'Customers'
              : tab === 'transactions'
              ? 'Issue / Return'
              : 'Transaction History'}
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
                  data.customers.map((customer) => {
                    const hasUnreturnedBook = groupedTransactions.some(
                      (tx) => tx.customerId === customer.id && tx.issuedAt !== null && tx.returnedAt === null
                    );
                    return (
                      <article key={customer.id} id={`customer-card-${customer.id}`} className="item-card customer-item-card">
                        <div className="customer-card-main">
                          <div>
                            <strong>{customer.name}</strong>
                            <p>{customer.email} · {customer.phone}</p>
                            <span className="badge">{customer.membership}</span>
                          </div>
                          <div className="item-actions">
                            {hasUnreturnedBook && (
                              <img
                                src="/images.png"
                                alt="Pending Return"
                                className="pending-icon"
                                title="Has pending book return"
                              />
                            )}
                            <button type="button" className="secondary" onClick={() => toggleCustomerHistory(customer.id)}>
                              {expandedCustomerHistory[customer.id] ? 'Hide History' : 'History'}
                            </button>
                            <button type="button" onClick={() => setEditingCustomerId(customer.id)}>
                              Edit
                            </button>
                            <button type="button" className="secondary" onClick={() => removeCustomer(customer.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      
                      {expandedCustomerHistory[customer.id] && (
                        <div className="customer-history-section">
                          <h4>Borrowing History</h4>
                          {(() => {
                            const customerHistory = groupedTransactions.filter((tx) => tx.customerId === customer.id);
                            if (customerHistory.length === 0) {
                              return <p className="no-history-text">No borrowing history found.</p>;
                            }
                            return (
                              <div className="customer-history-list">
                                {customerHistory.map((item) => {
                                  const book = data.books.find((b) => b.id === item.bookId);
                                  return (
                                    <div key={item.id} className="history-list-item">
                                      <span className="history-book-title">{book?.title ?? 'Unknown Book'}</span>
                                      <div className="history-dates">
                                        <span>Issued: {formatTimestamp(item.issuedAt)}</span>
                                        <span>Returned: {item.returnedAt ? formatTimestamp(item.returnedAt) : 'Pending'}</span>
                                      </div>
                                      <span className={`badge history-status-badge ${item.returnedAt ? 'returned' : 'borrowed'}`}>
                                        {item.returnedAt ? 'Returned' : 'Active'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </article>
                  );
                })
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
            </div>
          )}

          {activeTab === 'history' && (
            <div className="grid single-column">
              <section className="panel list-panel">
                <div className="panel-header">
                  <h2>Transaction history</h2>
                  <span>{groupedTransactions.length} records</span>
                </div>
                {groupedTransactions.length === 0 ? (
                  <div className="empty">No transactions yet.</div>
                ) : (
                  groupedTransactions.map((entry) => {
                    const customer = data.customers.find((c) => c.id === entry.customerId);
                    const book = data.books.find((b) => b.id === entry.bookId);
                    const duration = getDurationString(entry.issuedAt, entry.returnedAt);
                    
                    return (
                      <article key={entry.id} className="item-card transaction-card-premium">
                        <div className="transaction-info-header">
                          <span className={`badge status-badge ${entry.returnedAt ? 'returned' : 'borrowed'}`}>
                            {entry.returnedAt ? 'Completed' : 'Active Borrow'}
                          </span>
                          <div className="transaction-actions-header">
                            {duration && <span className="duration-tag">⏱️ {duration}</span>}
                            <button
                              type="button"
                              onClick={() => startEditTransaction(entry)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => removeTransaction(entry)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        
                        <div className="transaction-details">
                          <div className="detail-section">
                            <span className="section-label">Customer Name</span>
                            {customer ? (
                              <button
                                type="button"
                                className="link-button detail-name"
                                onClick={() => handleCustomerClick(customer.id)}
                                title="Click to view customer details"
                              >
                                {customer.name}
                              </button>
                            ) : (
                              <strong className="detail-name">Unknown</strong>
                            )}
                            {customer && <span className="badge membership-badge-small">{customer.membership}</span>}
                          </div>
                          
                          <div className="detail-section">
                            <span className="section-label">Book Details</span>
                            <strong className="detail-name">{book?.title ?? 'Unknown Book'}</strong>
                            <p className="detail-subtext">{book ? `${book.author} · ${book.genre}` : ''}</p>
                          </div>
                          
                          <div className="detail-timeline">
                            <div className="timeline-item">
                              <span className="dot start"></span>
                              <div className="timeline-text-group">
                                <span className="time-label">Issued</span>
                                <span className="time-value">{formatTimestamp(entry.issuedAt)}</span>
                              </div>
                            </div>
                            <div className="timeline-item">
                              <span className={`dot ${entry.returnedAt ? 'end' : 'pending'}`}></span>
                              <div className="timeline-text-group">
                                <span className="time-label">Returned</span>
                                <span className="time-value return-value">
                                  {entry.returnedAt ? (
                                    formatTimestamp(entry.returnedAt)
                                  ) : (
                                    <span className="pulsing-text">Pending Return</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            </div>
          )}
        </>
      )}

      {editingTransaction && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit Transaction</h2>
            <label>
              Customer Name
              <select
                value={editTxForm.customerId}
                onChange={(e) => setEditTxForm({ ...editTxForm, customerId: e.target.value })}
              >
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Book Details
              <select
                value={editTxForm.bookId}
                onChange={(e) => setEditTxForm({ ...editTxForm, bookId: e.target.value })}
              >
                {data.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Issued At
              <input
                type="datetime-local"
                value={editTxForm.issuedAt}
                onChange={(e) => setEditTxForm({ ...editTxForm, issuedAt: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editTxForm.isReturned}
                onChange={(e) => setEditTxForm({ ...editTxForm, isReturned: e.target.checked })}
              />
              Returned?
            </label>
            {editTxForm.isReturned && (
              <label>
                Returned At
                <input
                  type="datetime-local"
                  value={editTxForm.returnedAt}
                  onChange={(e) => setEditTxForm({ ...editTxForm, returnedAt: e.target.value })}
                />
              </label>
            )}
            <div className="actions">
              <button type="button" onClick={handleEditTransactionSave}>
                Save Changes
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditingTransaction(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
