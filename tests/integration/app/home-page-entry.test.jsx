import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

describe('homepage app entry', () => {
  it('renders the landing page sections without duplicating navigation', () => {
    render(<Home />);

    const mainHeading = screen.getByRole('heading', { level: 1, name: /Dive Into Run/i });
    expect(mainHeading).toHaveTextContent('今天，一起出門跑。');
    expect(
      screen.getByText(/找到配速剛好、時間地點合適的跑步揪團/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    const viewActivityLinks = screen.getAllByRole('link', { name: /查看揪團活動|看全部活動/ });
    expect(viewActivityLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of viewActivityLinks) {
      expect(link).toHaveAttribute('href', '/events');
    }

    const createActivityLinks = screen.getAllByRole('link', { name: '新增跑步揪團' });
    expect(createActivityLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of createActivityLinks) {
      expect(link).toHaveAttribute('href', '/events');
    }

    expect(
      screen.getByRole('region', { name: '首頁主視覺' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '可以加入的揪團活動' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '加入活動前，先把必要資訊看清楚。' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '跑者公開檔案情境' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '建立清楚的活動頁' }),
    ).toBeInTheDocument();
  });

  it('shows static run, trust, profile, scene, and footer context', () => {
    render(<Home />);

    const runGroups = screen.getByRole('region', { name: '可以加入的揪團活動' });
    expect(within(runGroups).getByRole('heading', { name: '大安森林公園 8K' })).toBeInTheDocument();
    expect(within(runGroups).getByRole('heading', { name: '河濱輕鬆跑 5K' })).toBeInTheDocument();
    expect(within(runGroups).getByRole('heading', { name: '松山機場外圈 10K' })).toBeInTheDocument();
    expect(within(runGroups).getByText('6:30/km')).toBeInTheDocument();
    expect(within(runGroups).getByText('7:00/km')).toBeInTheDocument();
    expect(within(runGroups).getByText('5:50/km')).toBeInTheDocument();

    expect(screen.getByText('22°C 微風，適合晨跑')).toBeInTheDocument();
    expect(screen.getByText(/大安森林公園 · 06:18/)).toBeInTheDocument();
    expect(screen.getByText(/集合 pin · 捷運大安森林公園 2 號出口/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: '跑者公開檔案' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Strava 跑步紀錄' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '文章與活動留言' })).toBeInTheDocument();

    const profile = screen.getByRole('region', { name: '跑者公開檔案情境' });
    expect(within(profile).getByText(/陳以文 · 台北晨跑/)).toBeInTheDocument();
    expect(within(profile).getByText('18')).toBeInTheDocument();
    expect(within(profile).getByText('42')).toBeInTheDocument();
    expect(within(profile).getByText('328.4 km')).toBeInTheDocument();

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Dive Into Run');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Taipei running community');
  });
});
