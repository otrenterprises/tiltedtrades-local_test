import React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Calculator,
  Upload,
  BarChart3,
  Shield,
  Users,
  ChevronRight,
  Check,
  ArrowRight,
  Zap,
  Target,
  Award
} from 'lucide-react'

const Landing: React.FC = () => {
  const features = [
    {
      icon: Upload,
      title: 'Easy Data Import',
      description: 'Upload your trading data from any broker in seconds. Support for multiple formats including CSV, JSON, and Excel.'
    },
    {
      icon: Calculator,
      title: 'Advanced Calculations',
      description: 'FIFO and Per-Position matching methods with accurate P&L calculations including commissions and fees.'
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Analytics',
      description: 'Visualize your performance with detailed charts, statistics, and insights to improve your trading.'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is encrypted and stored securely. Control your privacy settings and choose what to share.'
    },
    {
      icon: Users,
      title: 'Community Features',
      description: 'Compare your performance on the leaderboard, share insights, and learn from successful traders.'
    },
    {
      icon: Zap,
      title: 'Real-Time Processing',
      description: 'Instant trade matching and statistics calculation. See your results immediately after upload.'
    }
  ]

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        'Up to 100 trades per month',
        'Basic analytics',
        'FIFO calculation method',
        'Export to CSV',
        'Community access'
      ],
      cta: 'Get Started',
      featured: false
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/month',
      features: [
        'Unlimited trades',
        'Advanced analytics & charts',
        'All calculation methods',
        'Priority processing',
        'Export to CSV, Excel, PDF',
        'Trade journaling',
        'API access',
        'Priority support'
      ],
      cta: 'Start Free Trial',
      featured: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      features: [
        'Everything in Pro',
        'Multi-user accounts',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Custom reports',
        'White-label options'
      ],
      cta: 'Contact Sales',
      featured: false
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Day Trader',
      content: 'TiltedTrades transformed how I track my performance. The analytics helped me identify patterns I never noticed before.',
      rating: 5
    },
    {
      name: 'Michael Rodriguez',
      role: 'Swing Trader',
      content: 'Finally, a platform that handles complex options trades correctly. The Per-Position matching is exactly what I needed.',
      rating: 5
    },
    {
      name: 'Emma Thompson',
      role: 'Portfolio Manager',
      content: 'The ability to switch between FIFO and Per-Position views gives me insights I cant get anywhere else. Essential tool!',
      rating: 5
    }
  ]

  const stats = [
    { value: '10K+', label: 'Active Traders' },
    { value: '1M+', label: 'Trades Analyzed' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9/5', label: 'User Rating' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary via-primary to-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-primary/80 backdrop-blur-md z-50 border-b border-theme">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-500 mr-2" />
              <span className="text-xl font-bold">TiltedTrades</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="hover:text-green-500 transition">Features</a>
              <a href="#pricing" className="hover:text-green-500 transition">Pricing</a>
              <a href="#testimonials" className="hover:text-green-500 transition">Testimonials</a>
              <a href="https://app.tiltedtrades.com" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition">
                Launch App
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-8">
            <Zap className="h-4 w-4 text-green-500 mr-2" />
            <span className="text-sm text-green-400">New: Advanced Options Analytics Now Available</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Master Your Trading
            <br />Performance
          </h1>

          <p className="text-xl text-tertiary mb-8 max-w-3xl mx-auto">
            Professional-grade trade tracking and analytics platform. Upload your trades,
            get instant insights, and optimize your strategy with data-driven decisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a
              href="https://app.tiltedtrades.com/signup"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold transition transform hover:scale-105 inline-flex items-center justify-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a
              href="#features"
              className="bg-secondary hover:bg-tertiary text-white px-8 py-4 rounded-lg font-semibold transition inline-flex items-center justify-center"
            >
              Learn More
              <ChevronRight className="ml-2 h-5 w-5" />
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-green-500">{stat.value}</div>
                <div className="text-sm text-tertiary mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-primary/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Succeed</h2>
            <p className="text-xl text-tertiary">Powerful features designed for serious traders</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="bg-secondary/50 backdrop-blur-sm border border-theme rounded-xl p-6 hover:border-green-500/50 transition"
                >
                  <div className="bg-green-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-tertiary">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-tertiary">Get started in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-500">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Your Data</h3>
              <p className="text-tertiary">Import trades from your broker in CSV, JSON, or Excel format</p>
            </div>

            <div className="text-center">
              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-500">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Automatic Analysis</h3>
              <p className="text-tertiary">Our system matches trades and calculates your true P&L instantly</p>
            </div>

            <div className="text-center">
              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-500">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Gain Insights</h3>
              <p className="text-tertiary">View detailed analytics and improve your trading strategy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-primary/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-tertiary">Choose the plan that fits your trading style</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-secondary/50 backdrop-blur-sm border rounded-xl p-8 ${
                  plan.featured
                    ? 'border-green-500 shadow-lg shadow-green-500/20'
                    : 'border-theme'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-black text-sm font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-tertiary ml-2">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.name === 'Enterprise' ? 'mailto:sales@tiltedtrades.com' : 'https://app.tiltedtrades.com/signup'}
                  className={`block text-center py-3 rounded-lg font-semibold transition ${
                    plan.featured
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-tertiary hover:bg-secondary text-white'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Loved by Traders Worldwide</h2>
            <p className="text-xl text-tertiary">See what our users have to say</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-secondary/50 backdrop-blur-sm border border-theme rounded-xl p-6">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Award key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-secondary mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-tertiary">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-green-600/20 to-blue-600/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Level Up Your Trading?</h2>
          <p className="text-xl text-tertiary mb-8">
            Join thousands of traders who are already using TiltedTrades to improve their performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://app.tiltedtrades.com/signup"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold transition transform hover:scale-105 inline-flex items-center justify-center"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a
              href="https://app.tiltedtrades.com/demo"
              className="bg-secondary hover:bg-tertiary text-white px-8 py-4 rounded-lg font-semibold transition inline-flex items-center justify-center"
            >
              <Target className="mr-2 h-5 w-5" />
              View Live Demo
            </a>
          </div>
          <p className="text-sm text-tertiary mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-theme">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-500 mr-2" />
                <span className="text-lg font-bold">TiltedTrades</span>
              </div>
              <p className="text-tertiary text-sm">
                Professional trade tracking and analytics for serious traders.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="https://app.tiltedtrades.com/demo" className="hover:text-white transition">Demo</a></li>
                <li><a href="/api-docs" className="hover:text-white transition">API</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><a href="/about" className="hover:text-white transition">About</a></li>
                <li><a href="/blog" className="hover:text-white transition">Blog</a></li>
                <li><a href="/careers" className="hover:text-white transition">Careers</a></li>
                <li><a href="/contact" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><a href="/privacy" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="/security" className="hover:text-white transition">Security</a></li>
                <li><a href="/gdpr" className="hover:text-white transition">GDPR</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-theme text-center text-sm text-tertiary">
            <p>© 2025 TiltedTrades. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing