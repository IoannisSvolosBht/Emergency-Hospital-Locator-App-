import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders emergency locator', () => {
  render(<App />);
  const linkElement = screen.getByText(/Emergency Hospital Locator/i);
  expect(linkElement).toBeInTheDocument();
});
