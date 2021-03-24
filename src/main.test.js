import { render, screen } from '@testing-library/react';
import Viewer from './viewer';

test('renders learn react link', () => {
  render(<Viewer />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
